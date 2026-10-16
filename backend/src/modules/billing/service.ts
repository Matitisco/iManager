import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';
import { currentBlueRate } from '../../lib/blue-rate.js';
import { lockTransactionKey } from '../../lib/advisory-lock.js';
import { PLANS, PLAN_KEYS, BILLING_LOCK, storeBillingLock, arsAmount, billingSummary, addMonths, type PlanKey } from './domain.js';
import { getRemoteSubscription, hostedCheckout, mpRequest, remotePlanSchema, parseRemote, type RemoteSubscription } from './mercadopago.js';

function assertPlan(remote: z.infer<typeof remotePlanSchema>, key: PlanKey, providerId: string, amount: number) {
  const spec = PLANS[key];
  const checkout = new URL(hostedCheckout(remote.init_point, 'validation', 'validation@example.com'));
  if (remote.id !== providerId || checkout.searchParams.get('preapproval_plan_id') !== providerId || remote.auto_recurring.frequency !== spec.months || remote.auto_recurring.transaction_amount !== amount || remote.auto_recurring.free_trial) {
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

/** Operator-only script. No tenant can change the global USD price catalog. */
export async function syncPlans() {
  const rate = await currentBlueRate();
  const seller = parseRemote(z.object({ id: z.union([z.string(), z.number()]) }), await mpRequest('/users/me'));
  const sellerId = String(seller.id);
  const returnUrl = backUrl();
  const result: Array<{ key: string; amountArs: number }> = [];
  // Lock includes remote calls: single catalog mutation across workers/replicas.
  await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, BILLING_LOCK);
    for (const key of PLAN_KEYS) {
      const spec = PLANS[key];
      const existing = await tx.billingPlan.findUnique({ where: { key } });
      if (existing && existing.sellerId !== sellerId) throw new DomainError('El vendedor de MP cambió. Usá una base separada para TEST y producción.', 409);
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
      const remote = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(providerId)}`, 'PUT', { auto_recurring: recurring, back_url: returnUrl }));
      assertPlan(remote, key, providerId, amount);
      await tx.billingPlan.upsert({ where: { key }, create: { key, sellerId, providerId, initPoint: remote.init_point, amountArs: amount, exchangeRate: rate }, update: { initPoint: remote.init_point, amountArs: amount, exchangeRate: rate } });
      result.push({ key, amountArs: amount });
    }
  }, { timeout: 180_000, maxWait: 15_000 });
  return result;
}

export async function billingDetails(storeId: string) {
  const summary = await getBillingSummary(storeId);
  return { ...summary, plans: PLAN_KEYS.map(key => ({ key, ...PLANS[key] })) };
}
function assertCheckoutAllowed(summary: Awaited<ReturnType<typeof getBillingSummary>>, key: PlanKey) {
  if (summary.plan === 'INTERNAL') throw new DomainError('Tu plan interno es gratis de por vida y no necesita suscripción.', 409);
  // Cancelled subscriptions can be replaced only after the paid term ends.
  if (summary.canCancel || (summary.paidThrough && new Date(summary.paidThrough) > new Date())) {
    throw new DomainError('Ya tenés una suscripción. Cancelala y esperá al fin del período abonado para elegir otro plan.', 409);
  }
  if (summary.members > PLANS[key].users) throw new DomainError(`Este plan admite ${PLANS[key].users} ${PLANS[key].users === 1 ? 'usuario' : 'usuarios'}. Primero reducí tu equipo.`, 409);
}

export async function quoteCheckout(storeId: string, key: PlanKey, payerEmail: string) {
  const rate = await currentBlueRate();
  return prisma.$transaction(async tx => {
    await lockTransactionKey(tx, BILLING_LOCK);
    await lockTransactionKey(tx, storeBillingLock(storeId));
    assertCheckoutAllowed(await getBillingSummary(storeId, tx), key);
    let plan = await tx.billingPlan.findUnique({ where: { key } });
    if (!plan) throw new DomainError('Los planes todavía no están disponibles. Contactá a iManager.', 503);
    const amount = arsAmount(PLANS[key].usd, rate);
    if (Number(plan.amountArs) !== amount) {
      const remote = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(plan.providerId)}`, 'PUT', { auto_recurring: { transaction_amount: amount, currency_id: 'ARS' } }));
      assertPlan(remote, key, plan.providerId, amount);
      plan = await tx.billingPlan.update({ where: { key }, data: { amountArs: amount, exchangeRate: rate, initPoint: remote.init_point } });
    }
    const quote = await tx.billingCheckout.create({ data: { storeId, planKey: key, providerPlanId: plan.providerId, payerEmail: payerEmail.trim().toLowerCase(), amountArs: amount, exchangeRate: rate, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return { id: quote.id, key, usd: PLANS[key].usd, amountArs: amount, exchangeRate: rate, payerEmail: quote.payerEmail, expiresAt: quote.expiresAt.toISOString() };
  }, { timeout: 25_000, maxWait: 10_000 });
}
export async function openCheckout(storeId: string, quoteId: string) {
  return prisma.$transaction(async tx => {
    await lockTransactionKey(tx, BILLING_LOCK);
    await lockTransactionKey(tx, storeBillingLock(storeId));
    const quote = await tx.billingCheckout.findFirst({ where: { id: quoteId, storeId } });
    if (!quote) throw new DomainError('Cotización no encontrada.', 404);
    if (quote.expiresAt <= new Date()) throw new DomainError('La cotización venció. Volvé a consultar el importe.', 409);
    const key = quote.planKey as PlanKey;
    assertCheckoutAllowed(await getBillingSummary(storeId, tx), key);
    const plan = await tx.billingPlan.findUniqueOrThrow({ where: { key } });
    const remote = parseRemote(remotePlanSchema, await mpRequest(`/preapproval_plan/${encodeURIComponent(plan.providerId)}`));
    assertPlan(remote, key, quote.providerPlanId, Number(quote.amountArs));
    if (arsAmount(PLANS[key].usd, await currentBlueRate()) !== Number(quote.amountArs)) {
      throw new DomainError('Cambió el importe en pesos. Volvé a consultarlo antes de suscribirte.', 409);
    }
    const initPoint = hostedCheckout(remote.init_point, storeId, quote.payerEmail);
    await tx.billingCheckout.update({ where: { id: quote.id }, data: { openedAt: new Date() } });
    return { initPoint };
  }, { timeout: 25_000, maxWait: 10_000 });
}

/** Re-fetch under the tenant lock: duplicated/out-of-order webhooks cannot regress access. */
export async function reconcilePreapproval(id: string, expectedStoreId?: string) {
  const first = await getRemoteSubscription(id);
  const storeId = first.external_reference;
  if (!storeId || (expectedStoreId && expectedStoreId !== storeId)) return false;
  return prisma.$transaction(async tx => {
    await lockTransactionKey(tx, storeBillingLock(storeId));
    const store = await tx.store.findUnique({ where: { id: storeId } });
    if (!store || store.billingPlan === 'INTERNAL') return false;
    const remote = await getRemoteSubscription(id);
    if (remote.external_reference !== storeId || !remote.preapproval_plan_id) return false;
    const replacing = !!store.billingPreapprovalId && store.billingPreapprovalId !== id;
    if (replacing && (store.billingStatus !== 'CANCELLED' || (store.billingPaidThrough && store.billingPaidThrough > new Date()))) return false;
    if (replacing && (!remote.date_created || (store.billingRemoteUpdatedAt && new Date(remote.date_created) <= store.billingRemoteUpdatedAt))) return false;
    const plan = await tx.billingPlan.findUnique({ where: { providerId: remote.preapproval_plan_id } });
    if (!plan || !PLAN_KEYS.includes(plan.key as PlanKey)) return false;
    const spec = PLANS[plan.key as PlanKey];
    if (remote.auto_recurring.currency_id !== 'ARS' || remote.auto_recurring.frequency !== spec.months || remote.auto_recurring.frequency_type !== 'months') return false;
    const intention = await tx.billingCheckout.findFirst({ where: { storeId, providerPlanId: plan.providerId, openedAt: { not: null }, payerEmail: remote.payer_email?.trim().toLowerCase() ?? '__missing__' }, orderBy: { createdAt: 'desc' } });
    if (!intention) return false;
    const modified = new Date(remote.last_modified);
    if (!replacing && store.billingRemoteUpdatedAt && modified < store.billingRemoteUpdatedAt) return true;
    if (!replacing && store.billingStatus === 'CANCELLED' && remote.status !== 'cancelled') return true;
    // Authorization is not a successful charge. Never extend access from next_payment_date.
    const paidThrough = paidTerm(remote, spec.months);
    const previousThrough = replacing ? null : store.billingPaidThrough;
    const through = paidThrough && (!previousThrough || paidThrough > previousThrough) ? paidThrough : previousThrough;
    const cancelled = remote.status === 'cancelled';
    const hasPaidTerm = through && through > new Date();
    // Pending attempts never occupy the active subscription slot, so abandoned checkout is recoverable.
    if (remote.status === 'pending' && (!store.billingPreapprovalId || replacing)) return true;
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
    if (remote.external_reference !== storeId || remote.payer_email?.trim().toLowerCase() !== store.billingPayerEmail) throw new DomainError('No se pudo verificar la suscripción de esta tienda.', 409);
    const cancelled = z.object({ id: z.string(), status: z.literal('cancelled') }).safeParse(await mpRequest(`/preapproval/${encodeURIComponent(store.billingPreapprovalId)}`, 'PUT', { status: 'cancelled' }));
    if (!cancelled.success || cancelled.data.id !== store.billingPreapprovalId) throw new DomainError('Mercado Pago no confirmó la cancelación. Reintentá.', 502);
    const paidThrough = paidTerm(remote, store.billingPeriod === 'ANNUAL' ? 12 : 1);
    await tx.store.update({ where: { id: storeId }, data: {
      billingStatus: 'CANCELLED', billingRemoteUpdatedAt: new Date(),
      ...(paidThrough && (!store.billingPaidThrough || paidThrough > store.billingPaidThrough) ? { billingPaidThrough: paidThrough } : {}),
    } });
  }, { timeout: 30_000, maxWait: 10_000 });
}

export async function reconcileSubscriptions() {
  // IDs only, no business row exports or provider dumps.
  const stores = await prisma.store.findMany({ where: { billingPlan: { not: 'INTERNAL' }, billingPreapprovalId: { not: null } }, select: { id: true, billingPreapprovalId: true } });
  for (const store of stores) {
    await prisma.$transaction(async tx => {
      await lockTransactionKey(tx, storeBillingLock(store.id));
      const current = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
      if (current.billingStatus === 'CANCELLED' || !current.billingPreapprovalId) return;
      const remote = await getRemoteSubscription(current.billingPreapprovalId);
      if (remote.external_reference !== store.id || remote.payer_email?.trim().toLowerCase() !== current.billingPayerEmail || remote.status === 'cancelled') return;
      const plan = await tx.billingPlan.findUnique({ where: { providerId: remote.preapproval_plan_id ?? '' } });
      if (plan && Number(plan.amountArs) !== remote.auto_recurring.transaction_amount) {
        await mpRequest(`/preapproval/${encodeURIComponent(remote.id)}`, 'PUT', { auto_recurring: { transaction_amount: Number(plan.amountArs), currency_id: 'ARS' } });
      }
    }, { timeout: 30_000, maxWait: 10_000 });
    await reconcilePreapproval(store.billingPreapprovalId!, store.id);
  }
  return stores.length;
}

export async function refreshBilling(storeId: string) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  if (store.billingPlan === 'INTERNAL') return billingDetails(storeId);
  if (store.billingPreapprovalId && store.billingStatus !== 'CANCELLED') await reconcilePreapproval(store.billingPreapprovalId, storeId);
  else {
    const intention = await prisma.billingCheckout.findFirst({ where: { storeId, openedAt: { not: null } }, orderBy: { createdAt: 'desc' } });
    if (intention) {
      const search = parseRemote(z.object({ results: z.array(z.object({ id: z.string(), external_reference: z.string().optional() })).max(100) }),
        await mpRequest(`/preapproval/search?external_reference=${encodeURIComponent(storeId)}&payer_email=${encodeURIComponent(intention.payerEmail)}&limit=20`),
      );
      for (const remote of search.results) if (remote.external_reference === storeId) await reconcilePreapproval(remote.id, storeId);
    }
  }
  return billingDetails(storeId);
}
