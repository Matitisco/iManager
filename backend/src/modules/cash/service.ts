import { randomUUID } from 'node:crypto';
import { Prisma, type CashMovement, type CashRegister } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';
import { lockTransactionKey } from '../../lib/advisory-lock.js';
import { writeAudit, type Actor } from '../audit/audit.js';
import { canAccessSection } from '../stores/sections.js';
import { cashMethod, convertedMoney, countedMoney, money } from './math.js';

type Tx = Prisma.TransactionClient;
type Member = { role: string; sections?: unknown; userId: string };
export const canViewCash = (member: Member) => canAccessSection('cashBalances', member);
export const lockCash = (tx: Tx, storeId: string) => lockTransactionKey(tx, `cash:${storeId}`);
export async function cashDay(tx: Tx, storeId: string, now = new Date()) {
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: store.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
async function register(tx: Tx, storeId: string, id: string) {
  const row = await tx.cashRegister.findFirst({ where: { id, storeId } });
  if (!row) throw new DomainError('Caja no encontrada', 404);
  return row;
}
async function openSession(tx: Tx, box: CashRegister) {
  if (box.archivedAt) throw new DomainError('La caja está archivada', 409);
  const day = await cashDay(tx, box.storeId);
  const session = await tx.cashSession.findFirst({ where: { storeId: box.storeId, registerId: box.id, day, status: 'OPEN' } });
  if (!session) throw new DomainError(`Abrí la caja «${box.name}» para hoy; si está en revisión, completá el cierre`, 409);
  return session;
}
function movementResponse(row: CashMovement) {
  return { ...row, amount: Number(row.amount), exchangeRate: row.exchangeRate == null ? null : Number(row.exchangeRate), createdAt: row.createdAt.toISOString(), voidedAt: row.voidedAt?.toISOString() ?? null };
}
function countResponse(count: { id: string; expected: Prisma.Decimal; counted: Prisma.Decimal; difference: Prisma.Decimal; note: string | null; denominations: Prisma.JsonValue; countedBy: string; createdAt: Date }) {
  return { ...count, expected: Number(count.expected), counted: Number(count.counted), difference: Number(count.difference), createdAt: count.createdAt.toISOString() };
}
export async function listSessions(storeId: string, registerId: string) {
  await register(prisma, storeId, registerId);
  const sessions = await prisma.cashSession.findMany({ where: { storeId, registerId, status: 'APPROVED' }, orderBy: { day: 'desc' }, take: 100, include: { counts: { orderBy: { createdAt: 'asc' } } } });
  return { sessions: sessions.map(session => ({ id: session.id, day: session.day, status: session.status, reviewNote: session.reviewNote, counts: session.counts.map(countResponse) })) };
}
async function append(tx: Tx, box: CashRegister, data: Omit<Prisma.CashMovementUncheckedCreateInput, 'storeId' | 'registerId'>, requireOpen = true) {
  const session = requireOpen ? await openSession(tx, box) : null;
  const row = await tx.cashMovement.create({ data: { ...data, currency: box.currency, method: box.method, storeId: box.storeId, registerId: box.id, sessionId: session?.id ?? data.sessionId ?? null } });
  await tx.cashRegister.update({ where: { id: box.id }, data: { balance: { increment: data.amount } } });
  return row;
}
async function cashAudit(tx: Tx, storeId: string, actor: Actor, action: string, id: string, detail?: string) {
  await writeAudit(tx, { storeId, actor, action: `cash.${action}`, entityType: 'cash', entityId: id, detail });
}

export async function listRegisters(storeId: string, member: Member) {
  const view = canViewCash(member);
  const rows = await prisma.cashRegister.findMany({ where: { storeId }, orderBy: { createdAt: 'asc' }, include: { sessions: { orderBy: { day: 'desc' }, take: 1, include: { counts: { orderBy: { createdAt: 'asc' } } } } } });
  return { canViewBalances: view, registers: rows.map(row => {
    const last = row.sessions[0];
    // OPEN/RECOUNT never discloses an earlier count, even to the counter.
    const showCounts = last && ['SUBMITTED', 'APPROVED'].includes(last.status) && (view || last.counts.at(-1)?.countedBy === member.userId);
    return { id: row.id, name: row.name, currency: row.currency, method: row.method, isDefault: row.isDefault, archivedAt: row.archivedAt?.toISOString() ?? null, ...(view ? { balance: Number(row.balance) } : {}), session: last ? {
      id: last.id, day: last.day, status: last.status, reviewNote: last.reviewNote,
      ...(showCounts ? { counts: (view ? last.counts : last.counts.slice(-1)).map(countResponse) } : {}),
    } : null };
  }) };
}
export async function createRegister(storeId: string, input: { name: string; currency: string; method: string; opening: number }, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const first = !await tx.cashRegister.findFirst({ where: { storeId, currency: input.currency, method: input.method, isDefault: true, archivedAt: null } });
    const row = await tx.cashRegister.create({ data: { storeId, name: input.name, currency: input.currency, method: input.method, balance: money(input.opening), isDefault: first } });
    if (input.opening) await tx.cashMovement.create({ data: { storeId, registerId: row.id, amount: money(input.opening), kind: 'FONDO', note: 'Saldo inicial', createdBy: actor.userId } });
    await cashAudit(tx, storeId, actor, 'created', row.id);
    return { id: row.id };
  });
}
export async function editRegister(storeId: string, id: string, input: { name?: string; archived?: boolean; isDefault?: boolean }, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const box = await register(tx, storeId, id);
    if (input.archived && await tx.cashSession.findFirst({ where: { registerId: id, status: { not: 'APPROVED' } } })) throw new DomainError('Completá el cierre antes de archivar', 409);
    if (input.isDefault && (input.archived || box.archivedAt && input.archived !== false)) throw new DomainError('Desarchivá la caja antes de hacerla predeterminada');
    if (input.isDefault) await tx.cashRegister.updateMany({ where: { storeId, currency: box.currency, method: box.method }, data: { isDefault: false } });
    await tx.cashRegister.update({ where: { id }, data: { name: input.name, ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null, ...(input.archived ? { isDefault: false } : {}) } : {}), ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}) } });
    await cashAudit(tx, storeId, actor, 'updated', id);
  });
}
export async function startSession(storeId: string, registerId: string, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const box = await register(tx, storeId, registerId);
    if (box.archivedAt) throw new DomainError('Desarchivá la caja primero', 409);
    const day = await cashDay(tx, storeId);
    const last = await tx.cashSession.findFirst({ where: { registerId, storeId }, orderBy: { day: 'desc' } });
    if (last?.day === day && last.status === 'OPEN') return { id: last.id };
    if (last?.status !== 'APPROVED' && last) throw new DomainError('El día anterior quedó sin cerrar. Contalo y pedí aprobación antes de abrir otro día', 409);
    if (last && last.day >= day) throw new DomainError('Esta caja ya se cerró hoy. Abrí el próximo día', 409);
    const session = await tx.cashSession.create({ data: { storeId, registerId, day, opening: box.balance, openedBy: actor.userId } });
    await cashAudit(tx, storeId, actor, 'opened', session.id);
    return { id: session.id };
  });
}
export async function manualMovement(storeId: string, input: { registerId: string; kind: 'INGRESO' | 'EGRESO' | 'AJUSTE'; amount: number; category?: string | null; note?: string | null; requestKey: string }, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const box = await register(tx, storeId, input.registerId);
    if (input.kind === 'EGRESO' && !input.category?.trim()) throw new DomainError('El egreso necesita una categoría');
    if (input.kind === 'AJUSTE' && !input.note?.trim()) throw new DomainError('Explicá el ajuste de saldo');
    const signed = money(input.kind === 'EGRESO' ? -input.amount : input.amount);
    const prior = await tx.cashMovement.findFirst({ where: { storeId, requestKey: input.requestKey } });
    if (prior) {
      if (prior.registerId !== box.id || prior.kind !== input.kind || !prior.amount.eq(signed) || prior.category !== (input.category || null) || prior.note !== (input.note || null)) throw new DomainError('La solicitud ya corresponde a otro movimiento', 409);
      return { id: prior.id };
    }
    const row = await append(tx, box, { amount: signed, kind: input.kind, category: input.category || null, note: input.note || null, requestKey: input.requestKey, createdBy: actor.userId });
    await cashAudit(tx, storeId, actor, 'movement', row.id, `${row.amount} ${box.currency}`);
    return { id: row.id };
  });
}
export async function transferFunds(storeId: string, input: { fromId: string; toId: string; amount: number; exchangeRate?: number; note?: string; requestKey: string }, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    if (input.fromId === input.toId) throw new DomainError('Elegí dos cajas distintas');
    const from = await register(tx, storeId, input.fromId);
    const to = await register(tx, storeId, input.toId);
    const amount = money(input.amount);
    const converted = convertedMoney(input.amount, from.currency, to.currency, input.exchangeRate);
    const rate = from.currency === to.currency ? null : money(input.exchangeRate!);
    const prior = await tx.cashMovement.findFirst({ where: { storeId, requestKey: input.requestKey } });
    if (prior) {
      const other = await tx.cashMovement.findFirst({ where: { storeId, transferGroup: prior.transferGroup, amount: { gt: 0 } } });
      if (prior.registerId !== from.id || !prior.amount.eq(amount.neg()) || other?.registerId !== to.id || !other.amount.eq(converted) || String(prior.exchangeRate) !== String(rate) || prior.note !== (input.note || null)) throw new DomainError('La solicitud ya corresponde a otra conversión', 409);
      return { id: prior.id };
    }
    if (from.balance.lt(amount)) throw new DomainError('La caja de origen no tiene fondos suficientes');
    const group = randomUUID();
    const common = { kind: 'TRANSFERENCIA', transferGroup: group, exchangeRate: rate, note: input.note || null, createdBy: actor.userId };
    const debit = await append(tx, from, { ...common, amount: amount.neg(), requestKey: input.requestKey });
    await append(tx, to, { ...common, amount: converted });
    await cashAudit(tx, storeId, actor, 'transferred', debit.id, `${amount} ${from.currency} → ${converted} ${to.currency} · ${rate ?? 1}`);
    return { id: debit.id };
  });
}
/** Business operations never require a session and never change a closed register. */
async function appendAutomatic(tx: Tx, storeId: string, currency: string, method: string, data: Omit<Prisma.CashMovementUncheckedCreateInput, 'storeId' | 'registerId'>) {
  const day = await cashDay(tx, storeId);
  const box = await tx.cashRegister.findFirst({
    where: { storeId, currency, method, archivedAt: null, sessions: { some: { storeId, day, status: 'OPEN' } } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  if (box) return append(tx, box, data);
  return tx.cashMovement.create({ data: { ...data, storeId, currency, method, registerId: null, sessionId: null } });
}
async function reverse(tx: Tx, row: CashMovement, actor?: Actor | null, note = 'Anulación') {
  if (row.voidedAt || row.reversalOf) return;
  if (await tx.cashMovement.findFirst({ where: { storeId: row.storeId, reversalOf: row.id } })) return;
  // Existing movements get their denomination from their register; new unassigned
  // movements carry it themselves. Preserve the original movement, even after close.
  const box = row.registerId ? await register(tx, row.storeId, row.registerId) : null;
  const currency = row.currency ?? box!.currency;
  const method = row.method ?? box!.method;
  await appendAutomatic(tx, row.storeId, currency, method, { amount: row.amount.neg(), kind: 'ANULACION', category: row.category, note, sourceType: row.sourceType, sourceId: row.sourceId, reversalOf: row.id, transferGroup: row.transferGroup, exchangeRate: row.exchangeRate, createdBy: actor?.userId });
}
export async function voidMovement(storeId: string, id: string, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const row = await tx.cashMovement.findFirst({ where: { id, storeId } });
    if (!row) throw new DomainError('Movimiento no encontrado', 404);
    if (row.sourceType) throw new DomainError('Anulá este movimiento desde la venta, seña o reparación de origen', 409);
    if (!['INGRESO', 'EGRESO', 'AJUSTE', 'TRANSFERENCIA'].includes(row.kind)) throw new DomainError('Este movimiento no se puede anular desde Cajas', 409);
    const rows = row.transferGroup ? await tx.cashMovement.findMany({ where: { storeId, transferGroup: row.transferGroup, reversalOf: null } }) : [row];
    for (const original of rows) await reverse(tx, original, actor);
    await cashAudit(tx, storeId, actor, 'voided', id);
  });
}
export async function changeCategory(storeId: string, id: string, category: string | null, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const row = await tx.cashMovement.findFirst({ where: { id, storeId } });
    if (!row) throw new DomainError('Movimiento no encontrado', 404);
    if (row.kind === 'EGRESO' && !category) throw new DomainError('El egreso necesita una categoría');
    await tx.cashMovement.update({ where: { id }, data: { category } });
    await cashAudit(tx, storeId, actor, 'category', id);
  });
}
export async function countSession(storeId: string, id: string, input: { denominations?: Record<string, number>; counted?: number; note?: string }, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const session = await tx.cashSession.findFirst({ where: { id, storeId }, include: { register: true } });
    if (!session) throw new DomainError('Sesión no encontrada', 404);
    if (!['OPEN', 'RECOUNT'].includes(session.status)) throw new DomainError('El conteo ya está guardado', 409);
    const total = session.register.method === 'EFECTIVO' ? countedMoney(session.register.currency, input.denominations ?? {}) : money(input.counted ?? 0);
    if (session.register.method === 'EFECTIVO' && !input.denominations) throw new DomainError('Completá el conteo por denominación');
    if (session.register.method === 'TRANSFERENCIA' && input.counted === undefined) throw new DomainError('Ingresá el total contado');
    const expected = session.register.balance;
    const difference = total.sub(expected);
    if (!difference.eq(0) && !input.note?.trim()) throw new DomainError('Explicá la diferencia en una nota antes de guardar');
    const count = await tx.cashCount.create({ data: { storeId, sessionId: id, expected, counted: total, difference, denominations: input.denominations, note: input.note || null, countedBy: actor.userId } });
    await tx.cashSession.update({ where: { id }, data: { status: 'SUBMITTED', reviewNote: null } });
    await cashAudit(tx, storeId, actor, 'counted', id);
    return { id: count.id, expected: Number(expected), counted: Number(total), difference: Number(difference) };
  });
}
export async function reviewSession(storeId: string, id: string, input: { action: 'APPROVE' | 'RECOUNT'; note?: string }, actor: Actor) {
  return prisma.$transaction(async tx => {
    await lockCash(tx, storeId);
    const session = await tx.cashSession.findFirst({ where: { id, storeId }, include: { register: true, counts: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!session) throw new DomainError('Sesión no encontrada', 404);
    if (input.action === 'APPROVE' && session.status === 'APPROVED') return;
    if (session.status !== 'SUBMITTED') throw new DomainError('Guardá el conteo antes de revisarlo', 409);
    if (input.action === 'RECOUNT' && !input.note?.trim()) throw new DomainError('Explicá qué debe recontarse');
    if (input.action === 'APPROVE') {
      const count = session.counts[0]!;
      if (!count.difference.eq(0)) await append(tx, session.register, { amount: count.difference, sessionId: session.id, kind: 'ARQUEO', note: count.note, createdBy: actor.userId }, false);
    }
    await tx.cashSession.update({ where: { id }, data: { status: input.action === 'APPROVE' ? 'APPROVED' : 'RECOUNT', reviewNote: input.note || null, ...(input.action === 'APPROVE' ? { approvedBy: actor.userId, approvedAt: new Date() } : {}) } });
    await cashAudit(tx, storeId, actor, input.action.toLowerCase(), id, input.note);
  });
}
export async function listMovements(storeId: string, id: string, input: { from?: string; to?: string; category?: string; offset: number }) {
  const box = await register(prisma, storeId, id);
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  // PostgreSQL resolves local midnight, including DST. Stored timestamps are UTC.
  const [bounds] = await prisma.$queryRaw<Array<{ start: Date | null; end: Date | null }>>`
    SELECT (CAST(${input.from ?? null} AS date)::timestamp AT TIME ZONE ${store.timezone}) AT TIME ZONE 'UTC' AS start,
           ((CAST(${input.to ?? null} AS date) + 1)::timestamp AT TIME ZONE ${store.timezone}) AT TIME ZONE 'UTC' AS end
  `;
  const base = { storeId, registerId: box.id };
  const where: Prisma.CashMovementWhereInput = {
    ...base,
    ...(input.category === '__none__' ? { category: null } : input.category ? { category: input.category } : {}),
    ...(bounds?.start || bounds?.end ? { createdAt: { ...(bounds.start ? { gte: bounds.start } : {}), ...(bounds.end ? { lt: bounds.end } : {}) } } : {}),
  };
  const [rows, total, categories] = await Promise.all([
    prisma.cashMovement.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: input.offset, take: 50 }),
    prisma.cashMovement.count({ where }),
    prisma.cashMovement.findMany({ where: { ...base, category: { not: null } }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ]);
  const reversals = await prisma.cashMovement.findMany({ where: { storeId, reversalOf: { in: rows.map(row => row.id) } }, select: { reversalOf: true, createdAt: true } });
  const voided = new Map(reversals.map(row => [row.reversalOf, row.createdAt]));
  return { movements: rows.map(row => movementResponse({ ...row, voidedAt: row.voidedAt ?? voided.get(row.id) ?? null })), total, categories: categories.flatMap(row => row.category ? [row.category] : []) };
}
/** Called only for new real money; never for historical imports, deposits applied or accounting adjustments. */
export async function recordCash(tx: Tx, input: { storeId: string; amount: number; currency: string; method: string; sourceType: string; sourceId: string; note: string; actor?: Actor | null; requestKey?: string }) {
  if (!input.amount) return;
  await lockCash(tx, input.storeId);
  const method = cashMethod(input.method);
  if (!method) return;
  const box = await tx.cashRegister.findFirst({ where: { storeId: input.storeId, currency: input.currency, method, archivedAt: null } });
  if (!box) return;
  if (input.requestKey && await tx.cashMovement.findFirst({ where: { storeId: input.storeId, requestKey: input.requestKey } })) return;
  await appendAutomatic(tx, input.storeId, input.currency, method, { amount: money(input.amount), kind: input.amount > 0 ? 'COBRO' : 'DEVOLUCION', sourceType: input.sourceType, sourceId: input.sourceId, note: input.note, createdBy: input.actor?.userId, requestKey: input.requestKey });
}
export async function reverseCashSource(tx: Tx, storeId: string, sourceType: string, sourceId: string, actor?: Actor | null) {
  await lockCash(tx, storeId);
  const rows = await tx.cashMovement.findMany({ where: { storeId, sourceType, sourceId, voidedAt: null, reversalOf: null } });
  for (const row of rows) await reverse(tx, row, actor, 'Devolución desde el origen');
}
