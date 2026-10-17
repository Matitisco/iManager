import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { DomainError, domainErrorFrom } from '../../lib/domain-error.js';
import { currentBlueRate } from '../../lib/blue-rate.js';
import { lockTransactionKey } from '../../lib/advisory-lock.js';
import { PLANS, PLAN_KEYS, BILLING_LOCK, storeBillingLock, arsAmount, billingSummary, addMonths, type PlanKey } from './domain.js';
import { limitCheckout } from './checkout-rate-limit.js';
import { assertMercadoPagoCheckoutUrl, getRemoteSubscription, MPRejectedRequest, mpRequest, remotePlanSchema, remoteSubscriptionSchema, parseRemote, type RemoteSubscription } from './mercadopago.js';

function assertPlan(remote: z.infer<typeof remotePlanSchema>, key: PlanKey, providerId: string, amount: number) {
  const spec = PLANS[key];
  if (remote.id !== providerId || remote.auto_recurring.frequency !== spec.months || remote.auto_recurring.transaction_amount !== amount || remote.auto_recurring.free_trial) {
    throw new DomainError('Mercado Pago no confirmó las condiciones del plan. Volvé a consultar el importe.', 409);
  }
}
function paidTerm(remote: RemoteSubscription, months: number) {
  const last = remote.summarized?.last_charged_date ? new Date(remote.summarized.last_charged_date) : null;
  return (remote.summarized?.charged_quantity ?? 0) > 0 && last && Number.isFinite(last.getTime()) && last <= new Date() ? addMonths(last, months) : null;
}

export async function getBillingSummary(storeId: string, db: Prisma.TransactionClient = prisma) {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  return billingSummary(store, await db.storeMember.count({ where: { storeId } }));
}
export async function assertBillingWrite(storeId: string, db: Prisma.TransactionClient = prisma) {
  if ((await getBillingSummary(storeId, db)).readOnly) {
    throw new DomainError('Tu tienda está en modo solo lectura. Revisá Plan y facturación para volver a operar.', 402);
  }
}
export async function assertMemberCapacity(storeId: string, db: Prisma.TransactionClient = prisma) {
  const summary = await getBillingSummary(storeId, db);
  if (summary.readOnly) throw new DomainError('La tienda está en modo solo lectura. El propietario debe revisar su suscripción.', 402);
  if (summary.memberLimit !== null && summary.members >= summary.memberLimit) {
    throw new DomainError(`Tu plan admite ${summary.memberLimit} ${summary.memberLimit === 1 ? 'usuario' : 'usuarios'}, incluido el propietario. Revisá Plan y facturación.`, 409);
  }
}
function backUrl() {
  const configured = process.env.FRONTEND_URL?.trim();
  if (!configured) throw new DomainError('FRONTEND_URL es obligatorio para configurar la facturación.', 503);
  const url = new URL(configured);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && url.hostname === '127.0.0.1')) {
    throw new DomainError('La facturación requiere FRONTEND_URL con HTTPS.', 503);
  }
  url.hash = '/plan';
  return url.toString();
}

const OPEN_CHECKOUTS = ['QUOTED', 'CREATING', 'CREATED'] as const;
type SyncLog = { info: (message: string) => void; warn: (message: string) => void };

function sanitizeSyncMessage(message: string) {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  let text = message.replace(/\s+/g, ' ').trim();
  if (token) text = text.replaceAll(token, '[redacted]');
  text = text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted-email]');
  return text.slice(0, 180);
}

/** Safe line for the startup script. Status and message only; never a token, email or stack. */
export function syncFailureLine(cause: unknown) {
  const context = domainErrorFrom(cause)?.logContext;
  if (!context || typeof context.status !== 'number') return 'No se pudo sincronizar facturación. Revisá configuración y conectividad y reintentá.';
  const message = sanitizeSyncMessage(typeof context.message === 'string' ? context.message : '');
  return `No se pudo sincronizar facturación. Mercado Pago respondió ${context.status}: ${message}`;
}

/** Operator-only script. No tenant can change the global USD price catalog. */
export async function syncPlans(log: SyncLog = console) {
  const rate = await currentBlueRate();
  const seller = parseRemote(z.object({ id: z.union([z.string(), z.number()]) }), await mpRequest('/users/me'));
  const sellerId = String(seller.id);
  const returnUrl = backUrl();
  const result: Array<{ key: string; amountArs: number }> = [];
  // Lock includes remote calls: single catalog mutation across workers/replicas.
  const replaced = await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, BILLING_LOCK);
    const stored = await tx.billingPlan.findMany({ select: { sellerId: true } });
    const stale = stored.filter(plan => plan.sellerId !== sellerId);
    let foreignStores = 0;
    if (stale.length > 0) {
      // The previous seller's provider ids cannot be updated with the new token.
      await tx.billingPlan.deleteMany({ where: { sellerId: { not: sellerId } } });
      await tx.billingCheckout.updateMany({ where: { checkoutStatus: { in: [...OPEN_CHECKOUTS] } }, data: { checkoutStatus: 'FAILED' } });
      foreignStores = await tx.store.count({ where: { billingPlan: { not: 'INTERNAL' }, billingPreapprovalId: { not: null } } });
    }
    for (const key of PLAN_KEYS) {
      const spec = PLANS[key];
      const existing = await tx.billingPlan.findUnique({ where: { key } });
      const amount = arsAmount(spec.usd, rate);
      const recurring = { frequency: spec.months, frequency_type: 'months', transaction_amount: amount, currency_id: 'ARS' };
      let providerId = existing?.providerId;
      if (!providerId) {
        const reason = `iManager ${spec.name} ${spec.period === 'ANNUAL' ? 'anual' : 'mensual'}`;
        // Recover a plan created remotely before an interrupted local transaction.
        const search = parseRemote(z.object({ results: z.array(z.object({ id: z.string(), reason: z.string(), back_url: z.string().optional() })).max(100) }),
          await mpRequest(`/preapproval_plan/search?q=${encodeURIComponent(reason)}&limit=100`),
        );
        const matches = search.results.filter(plan => plan.reason === reason && plan.back_url === returnUrl);
        if (matches.length > 1) throw new DomainError('Hay planes duplicados en Mercado Pago. Revisalos antes de sincronizar.', 409);
        if (matches[0]) providerId = matches[0].id;
        else {
          const created = parseRemote(remotePlanSchema, await mpRequest('/preapproval_plan', 'POST', { reason, auto_recurring: recurring, back_url: returnUrl }));
          providerId = created.id;
        }
      }
      const remote = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(providerId)}`, 'PUT', { auto_recurring: recurring, back_url: returnUrl }, { purpose: 'plan' }));
      assertPlan(remote, key, providerId, amount);
      await tx.billingPlan.upsert({ where: { key }, create: { key, sellerId, providerId, initPoint: remote.init_point, amountArs: amount, exchangeRate: rate }, update: { sellerId, initPoint: remote.init_point, amountArs: amount, exchangeRate: rate } });
      result.push({ key, amountArs: amount });
    }
    return { plans: stale.length, foreignStores };
  }, { timeout: 180_000, maxWait: 15_000 });
  if (replaced.plans > 0) {
    log.info(`Vendedor de MP cambió: planes recreados para el vendedor nuevo (${replaced.plans})`);
    log.warn(`Suscripciones vigentes de otro vendedor: ${replaced.foreignStores} tiendas no internas.`);
  }
  return result;
}

const OPEN_CHECKOUT_STATUSES = ['QUOTED', 'CREATING', 'CREATED'] as const;
const ACTIVE_SUBSCRIPTION = 'Ya tenés una suscripción. Cancelala y esperá al fin del período abonado para elegir otro plan.';

async function subscriptionForCheckout(checkout: { id: string; checkoutStatus: string; providerSubscriptionId: string | null }) {
  if (checkout.checkoutStatus === 'QUOTED' && !checkout.providerSubscriptionId) return null;
  const ids: string[] = [];
  if (checkout.providerSubscriptionId) ids.push(checkout.providerSubscriptionId);
  else {
    const searchSchema = z.object({ results: z.array(z.object({ id: z.string(), external_reference: z.string().nullish() })).max(100) });
    try {
      const search = parseRemote(searchSchema, await mpRequest(`/preapproval/search?external_reference=${encodeURIComponent(checkout.id)}&limit=20`));
      for (const item of search.results) {
        if ((item.external_reference ?? '').trim() === checkout.id) ids.push(item.id);
      }
    } catch (cause) {
      if (!isStalePreapproval(cause)) throw cause;
    }
  }
  let pending: RemoteSubscription | null = null;
  for (const id of ids) {
    try {
      const remote = await getRemoteSubscription(id);
      const reference = (remote.external_reference ?? '').trim();
      if (!checkout.providerSubscriptionId && reference !== checkout.id) continue;
      if (remote.status === 'authorized' || remote.status === 'paused') return remote;
      if (remote.status === 'pending') pending = remote;
    } catch (cause) {
      if (!isStalePreapproval(cause)) throw cause;
    }
  }
  return pending;
}
async function cancelPendingPreapproval(id: string) {
  try {
    const cancelled = z.object({ id: z.string(), status: z.literal('cancelled') }).safeParse(await mpRequest(`/preapproval/${encodeURIComponent(id)}`, 'PUT', { status: 'cancelled' }));
    if (!cancelled.success || cancelled.data.id !== id) throw new DomainError('Mercado Pago no confirmó la cancelación. Reintentá.', 502);
  } catch (cause) {
    if (!isStalePreapproval(cause)) throw cause;
  }
}
/** A checkout that Mercado Pago never authorized cannot block another attempt. */
async function supersedeAbandonedCheckouts(storeId: string, exceptId?: string) {
  const open = await prisma.billingCheckout.findMany({
    where: { storeId, checkoutStatus: { in: [...OPEN_CHECKOUT_STATUSES] }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  let authorized: RemoteSubscription | null = null;
  for (const checkout of open) {
    const remote = await subscriptionForCheckout(checkout);
    if (remote && (remote.status === 'authorized' || remote.status === 'paused')) {
      authorized = remote;
      continue;
    }
    if (remote?.status === 'pending') await cancelPendingPreapproval(remote.id);
    await prisma.billingCheckout.updateMany({ where: { id: checkout.id, checkoutStatus: { in: [...OPEN_CHECKOUT_STATUSES] } }, data: { checkoutStatus: 'FAILED' } });
  }
  if (!authorized) return 'cleared' as const;
  await reconcilePreapproval(authorized.id, storeId);
  return 'authorized' as const;
}
const RECENT_ACTIVATION_MS = 30 * 60_000;
export async function billingDetails(storeId: string) {
  const summary = await getBillingSummary(storeId);
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { billingPlan: true, billingStatus: true, billingRemoteUpdatedAt: true } });
  const pendingCheckout = await prisma.billingCheckout.findFirst({ where: { storeId, openedAt: { not: null }, checkoutStatus: { in: ['CREATING', 'CREATED'] } }, select: { id: true } });
  const updatedAt = store.billingRemoteUpdatedAt?.getTime();
  const recentlyActivated = store.billingStatus === 'ACTIVE' && store.billingPlan !== 'INTERNAL' && store.billingPlan !== 'TRIAL' && !!updatedAt && Date.now() - updatedAt < RECENT_ACTIVATION_MS;
  return { ...summary, pendingCheckout: !!pendingCheckout, recentlyActivated, plans: PLAN_KEYS.map(key => ({ key, ...PLANS[key] })) };
}
function assertCheckoutAllowed(summary: Awaited<ReturnType<typeof getBillingSummary>>, key: PlanKey) {
  if (summary.plan === 'INTERNAL') throw new DomainError('Tu plan interno tiene acceso ilimitado y no necesita suscripción.', 409);
  // Cancelled subscriptions can be replaced only after the paid term ends.
  if (summary.canCancel || (summary.paidThrough && new Date(summary.paidThrough) > new Date())) {
    throw new DomainError(ACTIVE_SUBSCRIPTION, 409);
  }
  if (summary.members > PLANS[key].users) throw new DomainError(`Este plan admite ${PLANS[key].users} usuarios. Primero reducí tu equipo.`, 409);
}

export async function quoteCheckout(storeId: string, key: PlanKey, payerEmail: string) {
  if (await supersedeAbandonedCheckouts(storeId) === 'authorized') throw new DomainError(ACTIVE_SUBSCRIPTION, 409);
  const rate = await currentBlueRate();
  return prisma.$transaction(async tx => {
    await lockTransactionKey(tx, BILLING_LOCK);
    await lockTransactionKey(tx, storeBillingLock(storeId));
    assertCheckoutAllowed(await getBillingSummary(storeId, tx), key);
    if (await tx.billingCheckout.findFirst({ where: { storeId, checkoutStatus: { in: ['CREATING', 'CREATED'] } } })) {
      throw new DomainError('No pudimos cerrar un intento anterior. Reintentá.', 409);
    }
    let plan = await tx.billingPlan.findUnique({ where: { key } });
    if (!plan) throw new DomainError('Los planes todavía no están disponibles. Contactá a iManager.', 503);
    const amount = arsAmount(PLANS[key].usd, rate);
    if (Number(plan.amountArs) !== amount) {
      const remote = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(plan.providerId)}`, 'PUT', { auto_recurring: { transaction_amount: amount, currency_id: 'ARS' } }, { purpose: 'plan' }));
      assertPlan(remote, key, plan.providerId, amount);
      plan = await tx.billingPlan.update({ where: { key }, data: { amountArs: amount, exchangeRate: rate, initPoint: remote.init_point } });
    }
    const quote = await tx.billingCheckout.create({ data: { storeId, planKey: key, providerPlanId: plan.providerId, payerEmail: payerEmail.trim().toLowerCase(), amountArs: amount, exchangeRate: rate, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return { id: quote.id, key, usd: PLANS[key].usd, amountArs: amount, exchangeRate: rate, payerEmail: quote.payerEmail, expiresAt: quote.expiresAt.toISOString() };
  }, { timeout: 25_000, maxWait: 10_000 });
}
export async function openCheckout(storeId: string, quoteId: string) {
  limitCheckout(storeId);
  if (await supersedeAbandonedCheckouts(storeId, quoteId) === 'authorized') throw new DomainError(ACTIVE_SUBSCRIPTION, 409);
  // Persist the claim BEFORE contacting MP. A timeout or process crash must not permit a second charge.
  const quote = await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, BILLING_LOCK);
    await lockTransactionKey(tx, storeBillingLock(storeId));
    const quote = await tx.billingCheckout.findFirst({ where: { id: quoteId, storeId } });
    if (!quote) throw new DomainError('Cotización no encontrada.', 404);
    if (quote.checkoutStatus !== 'QUOTED') throw new DomainError('Esta solicitud ya fue enviada. Actualizá el estado del pago.', 409);
    if (quote.expiresAt <= new Date()) throw new DomainError('La cotización venció. Volvé a consultar el importe.', 409);
    const key = quote.planKey as PlanKey;
    assertCheckoutAllowed(await getBillingSummary(storeId, tx), key);
    if (await tx.billingCheckout.findFirst({ where: { storeId, id: { not: quote.id }, checkoutStatus: { in: ['CREATING', 'CREATED'] } } })) {
      throw new DomainError('No pudimos cerrar un intento anterior. Reintentá.', 409);
    }
    const plan = await tx.billingPlan.findUniqueOrThrow({ where: { key } });
    const remote = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(plan.providerId)}`, 'GET', undefined, { purpose: 'plan' }));
    assertPlan(remote, key, quote.providerPlanId, Number(quote.amountArs));
    if (arsAmount(PLANS[key].usd, await currentBlueRate()) !== Number(quote.amountArs)) {
      throw new DomainError('Cambió el importe en pesos. Volvé a consultarlo antes de suscribirte.', 409);
    }
    return tx.billingCheckout.update({ where: { id: quote.id }, data: { openedAt: new Date(), checkoutStatus: 'CREATING' } });
  }, { timeout: 25_000, maxWait: 10_000 });
  let remote: RemoteSubscription;
  let sent = false;
  try {
    remote = await prisma.$transaction(async tx => {
      // Keep price synchronization and tenant mutations out of the actual creation window.
      await lockTransactionKey(tx, BILLING_LOCK);
      await lockTransactionKey(tx, storeBillingLock(storeId));
      const key = quote.planKey as PlanKey;
      assertCheckoutAllowed(await getBillingSummary(storeId, tx), key);
      const plan = await tx.billingPlan.findUniqueOrThrow({ where: { key } });
      const conditions = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(plan.providerId)}`, 'GET', undefined, { purpose: 'plan' }));
      assertPlan(conditions, key, quote.providerPlanId, Number(quote.amountArs));
      if (quote.expiresAt <= new Date() || arsAmount(PLANS[key].usd, await currentBlueRate()) !== Number(quote.amountArs)) {
        throw new DomainError('La cotización cambió o venció. Volvé a consultar el importe.', 409);
      }
      const returnUrl = backUrl();
      const spec = PLANS[key];
      sent = true;
      // A plan-linked preapproval requires card_token_id and status authorized. Pending checkout is plan-less.
      const created = parseRemote(remoteSubscriptionSchema.extend({ init_point: z.string().min(1) }), await mpRequest('/preapproval', 'POST', {
        reason: `iManager ${spec.name} ${spec.period === 'ANNUAL' ? 'anual' : 'mensual'}`,
        external_reference: quote.id,
        payer_email: quote.payerEmail,
        auto_recurring: { frequency: spec.months, frequency_type: 'months', transaction_amount: Number(quote.amountArs), currency_id: 'ARS' },
        back_url: returnUrl,
        status: 'pending',
      }));
      await tx.billingCheckout.update({ where: { id: quote.id }, data: { providerSubscriptionId: created.id, checkoutStatus: 'CREATED' } });
      return created;
    }, { timeout: 35_000, maxWait: 10_000 });
  } catch (cause) {
    // Only a preflight failure or explicit rejection is safe to retry. Recover unknown outcomes by refresh/webhook.
    if (!sent || cause instanceof MPRejectedRequest) await prisma.billingCheckout.update({ where: { id: quote.id }, data: { checkoutStatus: 'FAILED' } });
    throw cause;
  }
  if (remote.external_reference !== quote.id) {
    await prisma.billingCheckout.update({ where: { id: quote.id }, data: { checkoutStatus: 'FAILED' } });
    throw new DomainError('Mercado Pago no confirmó la referencia del checkout.', 502);
  }
  if (!await reconcilePreapproval(remote.id, storeId)) throw new DomainError('No pudimos verificar la suscripción. Actualizá el estado del pago.', 502);
  if (remote.status === 'cancelled') throw new DomainError('Mercado Pago canceló la suscripción. Volvé a intentarlo.', 402);
  let initPoint: string;
  try { initPoint = assertMercadoPagoCheckoutUrl(remote.init_point ?? ''); }
  catch (cause) {
    await prisma.billingCheckout.update({ where: { id: quote.id }, data: { checkoutStatus: 'FAILED' } });
    throw cause;
  }
  return { initPoint };
}

async function planForRemote(tx: Prisma.TransactionClient, storeId: string, remote: RemoteSubscription, remoteReference: string) {
  if (remote.preapproval_plan_id) return tx.billingPlan.findUnique({ where: { providerId: remote.preapproval_plan_id } });
  const attempt = await tx.billingCheckout.findFirst({
    where: { storeId, openedAt: { not: null }, OR: [{ providerSubscriptionId: remote.id }, ...(remoteReference ? [{ id: remoteReference }] : [])] },
    orderBy: { createdAt: 'desc' },
  });
  if (!attempt || !PLAN_KEYS.includes(attempt.planKey as PlanKey)) return null;
  const plan = await tx.billingPlan.findUnique({ where: { key: attempt.planKey } });
  if (!plan || attempt.providerPlanId !== plan.providerId) return null;
  const amount = Number(remote.auto_recurring.transaction_amount);
  if (amount !== Number(attempt.amountArs) && amount !== Number(plan.amountArs)) return null;
  return plan;
}
function payerEmailMismatch(remoteEmail: string | null | undefined, stored: string | null) {
  const email = remoteEmail?.trim().toLowerCase() || '';
  return !!email && email !== (stored ?? '');
}
async function attemptForPreapproval(id: string, externalReference: string | null | undefined) {
  const reference = externalReference?.trim() || '';
  return prisma.billingCheckout.findFirst({
    where: { openedAt: { not: null }, OR: [{ providerSubscriptionId: id }, ...(reference ? [{ id: reference }] : [])] },
    orderBy: { createdAt: 'desc' },
  });
}

/** Re-fetch under the tenant lock: duplicated/out-of-order webhooks cannot regress access. */
export async function reconcilePreapproval(id: string, expectedStoreId?: string) {
  const first = await getRemoteSubscription(id);
  const attempt = await attemptForPreapproval(id, first.external_reference);
  const reference = first.external_reference?.trim() || '';
  const storeId = attempt?.storeId ?? reference;
  if (!storeId || (expectedStoreId && expectedStoreId !== storeId)) return false;
  return prisma.$transaction(async tx => {
    await lockTransactionKey(tx, storeBillingLock(storeId));
    const store = await tx.store.findUnique({ where: { id: storeId } });
    if (!store || store.billingPlan === 'INTERNAL') return false;
    const remote = await getRemoteSubscription(id);
    const remoteReference = remote.external_reference?.trim() || '';
    const linked = await tx.billingCheckout.findFirst({
      where: { storeId, openedAt: { not: null }, OR: [{ providerSubscriptionId: id }, ...(remoteReference ? [{ id: remoteReference }] : [])] },
      orderBy: { createdAt: 'desc' },
    });
    const referenceMatchesAttempt = !!linked && (linked.providerSubscriptionId === id || linked.id === remoteReference) && (!remoteReference || remoteReference === linked.id || remoteReference === storeId);
    const belongs = referenceMatchesAttempt || remoteReference === storeId;
    if (!belongs) return false;
    const replacing = !!store.billingPreapprovalId && store.billingPreapprovalId !== id;
    if (replacing && (store.billingStatus !== 'CANCELLED' || (store.billingPaidThrough && store.billingPaidThrough > new Date()))) return false;
    if (replacing && (!remote.date_created || (store.billingRemoteUpdatedAt && new Date(remote.date_created) <= store.billingRemoteUpdatedAt))) return false;
    const plan = await planForRemote(tx, storeId, remote, remoteReference);
    if (!plan || !PLAN_KEYS.includes(plan.key as PlanKey)) return false;
    const spec = PLANS[plan.key as PlanKey];
    if (remote.auto_recurring.currency_id !== 'ARS' || remote.auto_recurring.frequency !== spec.months || remote.auto_recurring.frequency_type !== 'months') return false;
    const intention = await tx.billingCheckout.findFirst({ where: { storeId, providerPlanId: plan.providerId, openedAt: { not: null }, providerSubscriptionId: id }, orderBy: { createdAt: 'desc' } })
      ?? (remoteReference ? await tx.billingCheckout.findFirst({ where: { id: remoteReference, storeId, providerPlanId: plan.providerId, openedAt: { not: null } }, orderBy: { createdAt: 'desc' } }) : null);
    if (!intention) return false;
    // A brand-new attempt that MP cancelled (rejected card) must not touch the store.
    if (remote.status === 'cancelled' && store.billingPreapprovalId !== id) {
      await tx.billingCheckout.updateMany({ where: { id: intention.id, checkoutStatus: { in: ['CREATING', 'CREATED'] } }, data: { checkoutStatus: 'FAILED', providerSubscriptionId: id } });
      return true;
    }
    const modified = new Date(remote.last_modified);
    if (!replacing && store.billingRemoteUpdatedAt && modified < store.billingRemoteUpdatedAt) return true;
    if (!replacing && store.billingStatus === 'CANCELLED' && remote.status !== 'cancelled') return true;
    // Authorization is not a successful charge. Never extend access from next_payment_date.
    const paidThrough = paidTerm(remote, spec.months);
    const previousThrough = replacing ? null : store.billingPaidThrough;
    const through = paidThrough && (!previousThrough || paidThrough > previousThrough) ? paidThrough : previousThrough;
    const cancelled = remote.status === 'cancelled';
    const hasPaidTerm = through && through > new Date();
    // Pending contracts keep the durable attempt unresolved; refresh can recover authorization.
    if (remote.status === 'pending' && (!store.billingPreapprovalId || replacing)) return true;
    await tx.billingCheckout.updateMany({ where: { id: intention.id, checkoutStatus: { in: ['CREATING', 'CREATED'] }, OR: [
      { providerSubscriptionId: id },
      // An old cancelled contract cannot resolve a new attempt whose response was lost.
      ...(store.billingPreapprovalId !== id ? [{ providerSubscriptionId: null }] : []),
    ] }, data: { checkoutStatus: 'RESOLVED', providerSubscriptionId: id } });
    await tx.store.update({ where: { id: storeId }, data: {
      billingPlan: spec.plan, billingPeriod: spec.period, billingPreapprovalId: id, billingPayerEmail: intention.payerEmail,
      billingRemoteUpdatedAt: modified, billingPaidThrough: through,
      billingStatus: cancelled ? 'CANCELLED' : hasPaidTerm ? 'ACTIVE' : 'EXPIRED',
    } });
    return true;
  }, { timeout: 25_000, maxWait: 10_000 });
}
export async function reconcileInvoice(id: string) {
  const invoice = z.object({ preapproval_id: z.string().min(1) }).safeParse(await mpRequest(`/authorized_payments/${encodeURIComponent(id)}`));
  if (!invoice.success) throw new DomainError('Mercado Pago devolvió una factura inválida.', 502);
  return reconcilePreapproval(invoice.data.preapproval_id);
}
export async function cancelSubscription(storeId: string) {
  return prisma.$transaction(async tx => {
    await lockTransactionKey(tx, storeBillingLock(storeId));
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    if (store.billingPlan === 'INTERNAL') throw new DomainError('El plan interno no tiene cobros para cancelar.', 409);
    if (!store.billingPreapprovalId || store.billingStatus === 'CANCELLED') return;
    const remote = await getRemoteSubscription(store.billingPreapprovalId);
    const reference = remote.external_reference?.trim() || '';
    const linked = reference === storeId || await tx.billingCheckout.findFirst({ where: { storeId, OR: [{ providerSubscriptionId: remote.id }, ...(reference ? [{ id: reference }] : [])] } });
    if (!linked || payerEmailMismatch(remote.payer_email, store.billingPayerEmail)) throw new DomainError('No se pudo verificar la suscripción de esta tienda.', 409);
    const cancelled = z.object({ id: z.string(), status: z.literal('cancelled') }).safeParse(await mpRequest(`/preapproval/${encodeURIComponent(store.billingPreapprovalId)}`, 'PUT', { status: 'cancelled' }));
    if (!cancelled.success || cancelled.data.id !== store.billingPreapprovalId) throw new DomainError('Mercado Pago no confirmó la cancelación. Reintentá.', 502);
    const paidThrough = paidTerm(remote, store.billingPeriod === 'ANNUAL' ? 12 : 1);
    await tx.store.update({ where: { id: storeId }, data: {
      billingStatus: 'CANCELLED', billingRemoteUpdatedAt: new Date(),
      ...(paidThrough && (!store.billingPaidThrough || paidThrough > store.billingPaidThrough) ? { billingPaidThrough: paidThrough } : {}),
    } });
  }, { timeout: 30_000, maxWait: 10_000 });
}

function isStalePreapproval(cause: unknown) {
  const context = domainErrorFrom(cause)?.logContext;
  if (!context || typeof context.status !== 'number') return false;
  const message = typeof context.message === 'string' ? context.message : '';
  if (context.status === 404) return true;
  return context.status === 400 && /not valid for callerId|not found/i.test(message);
}

/** The id belongs to another Mercado Pago seller. End the paid period so the store can subscribe again. */
async function releaseStalePreapproval(storeId: string, preapprovalId: string, log: SyncLog) {
  const ended = new Date();
  const released = await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, storeBillingLock(storeId));
    const current = await tx.store.findUnique({ where: { id: storeId } });
    if (!current || current.billingPlan === 'INTERNAL' || current.billingPreapprovalId !== preapprovalId) return false;
    await tx.store.update({ where: { id: storeId }, data: {
      billingPreapprovalId: null, billingStatus: 'EXPIRED', billingPaidThrough: ended, billingRemoteUpdatedAt: ended,
    } });
    return true;
  }, { timeout: 15_000, maxWait: 10_000 });
  if (released) log.info(`Suscripción de otro vendedor descartada para la tienda ${storeId}.`);
  return released;
}

export async function reconcileSubscriptions(log: SyncLog = console) {
  // IDs only, no business row exports or provider dumps.
  const stores = await prisma.store.findMany({ where: { billingPlan: { not: 'INTERNAL' }, billingPreapprovalId: { not: null } }, select: { id: true, billingPreapprovalId: true } });
  const failures: unknown[] = [];
  for (const store of stores) {
    const preapprovalId = store.billingPreapprovalId;
    if (!preapprovalId) continue;
    try {
      await prisma.$transaction(async tx => {
        await lockTransactionKey(tx, storeBillingLock(store.id));
        const current = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
        if (current.billingStatus === 'CANCELLED' || !current.billingPreapprovalId) return;
        const remote = await getRemoteSubscription(current.billingPreapprovalId);
        const reference = remote.external_reference?.trim() || '';
        const linked = reference === store.id || await tx.billingCheckout.findFirst({ where: { storeId: store.id, OR: [{ providerSubscriptionId: remote.id }, ...(reference ? [{ id: reference }] : [])] } });
        if (!linked || payerEmailMismatch(remote.payer_email, current.billingPayerEmail) || remote.status === 'cancelled') return;
        const plan = await planForRemote(tx, store.id, remote, reference);
        if (plan && Number(plan.amountArs) !== Number(remote.auto_recurring.transaction_amount)) {
          await mpRequest(`/preapproval/${encodeURIComponent(remote.id)}`, 'PUT', { auto_recurring: { transaction_amount: Number(plan.amountArs), currency_id: 'ARS' } });
        }
      }, { timeout: 30_000, maxWait: 10_000 });
      await reconcilePreapproval(preapprovalId, store.id);
    } catch (cause) {
      if (isStalePreapproval(cause)) {
        await releaseStalePreapproval(store.id, preapprovalId, log);
        continue;
      }
      failures.push(cause);
    }
  }
  if (failures.length > 0) throw failures[0];
  return stores.length;
}

export async function refreshBilling(storeId: string, log: SyncLog = console, options?: { replaceAbandoned?: boolean }) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  if (store.billingPlan === 'INTERNAL') return billingDetails(storeId);
  try {
    if (options?.replaceAbandoned) await supersedeAbandonedCheckouts(storeId);
    if (store.billingPreapprovalId && store.billingStatus !== 'CANCELLED') await reconcilePreapproval(store.billingPreapprovalId, storeId);
    else {
      const intention = await prisma.billingCheckout.findFirst({ where: { storeId, openedAt: { not: null } }, orderBy: { createdAt: 'desc' } });
      if (intention?.providerSubscriptionId) await reconcilePreapproval(intention.providerSubscriptionId, storeId);
      else if (intention) {
        const searchSchema = z.object({ results: z.array(z.object({ id: z.string(), external_reference: z.string().nullish() })).max(100) });
        const byAttempt = parseRemote(searchSchema, await mpRequest(`/preapproval/search?external_reference=${encodeURIComponent(intention.id)}&limit=20`));
        const byStore = byAttempt.results.length > 0 ? { results: [] as { id: string; external_reference?: string | null }[] } : parseRemote(searchSchema, await mpRequest(`/preapproval/search?external_reference=${encodeURIComponent(storeId)}&limit=20`));
        const results = [...byAttempt.results, ...byStore.results];
        for (const remote of results) if (remote.external_reference === intention.id || remote.external_reference === storeId) await reconcilePreapproval(remote.id, storeId);
        if (!results.some(remote => remote.external_reference === intention.id || remote.external_reference === storeId) && intention.createdAt < new Date(Date.now() - 2 * 60_000)) {
          await prisma.billingCheckout.updateMany({ where: { id: intention.id, checkoutStatus: { in: ['CREATING', 'CREATED'] }, providerSubscriptionId: null }, data: { checkoutStatus: 'FAILED' } });
        }
      }
    }
  } catch (cause) {
    if (store.billingPreapprovalId && store.billingStatus !== 'CANCELLED' && isStalePreapproval(cause)) {
      await releaseStalePreapproval(storeId, store.billingPreapprovalId, log);
    } else throw cause;
  }
  return billingDetails(storeId);
}
