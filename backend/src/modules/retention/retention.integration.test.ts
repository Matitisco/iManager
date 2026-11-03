import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { ensureTestDatabase, resetDatabase, seedCatalogFixture, seedStoreContext } from '../../test/db.js';
import { RETENTION_LOCK, runLogRetention } from './service.js';

const now = new Date('2026-11-03T12:00:00.000Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
const old = ago(1200);
const quiet = { info(_message: string) {} };
function run(extra: Record<string, string> = {}, log = quiet) {
  return runLogRetention({ now, log, allowTestExecution: true, environment: {
    DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: 'test', RETENTION_JOBS_ENABLED: 'true',
    RETENTION_DRY_RUN: 'false', ...extra,
  } });
}
async function seed() {
  const { store, user } = await seedStoreContext();
  return { storeId: store!.id, userId: user.id };
}
async function audit(storeId: string, action = 'member.removed', entityType = 'member', createdAt = old) {
  return prisma.auditEvent.create({ data: { storeId, action, entityType, createdAt,
    entityId: 'synthetic', actorName: 'private-fixture@example.invalid', detail: 'sensitive fixture' } });
}
async function notification(storeId: string, users: string[], createdAt = old, readAt = ago(91)) {
  return prisma.storeNotification.create({ data: { storeId, section: 'sales', kind: 'sale',
    title: 'Aviso ficticio', message: 'sensitive fixture', createdAt,
    reads: { create: users.map(userId => ({ userId, readAt })) } } });
}

beforeAll(ensureTestDatabase);
beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('retención con PostgreSQL', () => {
  it('borra solo auditoría de accesos vencida y conserva límites, finanzas y negocio íntegros', async () => {
    const { storeId, userId } = await seed();
    const other = await seedStoreContext({ firebaseUid: 'other' });
    const fixture = await seedCatalogFixture(storeId);
    const sale = await prisma.sale.create({ data: { storeId, clientId: fixture.client.id,
      inventoryItemId: fixture.inventoryItem.id, amount: 1200, dateLabel: 'Histórica',
      paymentMethod: 'Efectivo', status: 'ANULADA', soldAt: old, createdAt: old } });
    await prisma.clientPayment.create({ data: { storeId, clientId: fixture.client.id,
      saleId: sale.id, amount: 100, method: 'Efectivo', paidAt: old, createdAt: old } });
    const snapshot = async () => ({ sales: await prisma.sale.findMany(), clients: await prisma.client.findMany(),
      stock: await prisma.inventoryItem.findMany(), payments: await prisma.clientPayment.findMany(),
      members: await prisma.storeMember.findMany() });
    const businessBefore = await snapshot();
    const removed = [await audit(storeId), await audit(other.store!.id),
      await audit(storeId, 'invitation.cancelled', 'invitation')];
    const protectedRows = await Promise.all([
      audit(storeId, 'member.removed', 'member', ago(730)),
      audit(storeId, 'member.permissions', 'member', ago(729)),
      audit(storeId, 'sale.voided', 'sale'), audit(storeId, 'sale.payment', 'sale'),
      audit(storeId, 'inventory.cost', 'inventory'), audit(storeId, 'inventory.import', 'inventory'),
      audit(storeId, 'store.reset', 'store'), audit(storeId, 'new.unknown', 'member'),
      audit(storeId, 'member.removed', 'sale'),
    ]);
    await prisma.auditEvent.update({ where: { id: protectedRows[2].id }, data: { detail: JSON.stringify({ status: 'PENDIENTE', amount: 1200 }) } });
    const protectedBefore = await prisma.auditEvent.findMany({ where: { id: { in: protectedRows.map(r => r.id) } }, orderBy: { id: 'asc' } });
    const lines: string[] = [];
    const result = await run({}, { info: line => { lines.push(line); } });
    expect(result.counts.security).toBe(removed.length);
    expect(await prisma.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(protectedBefore);
    expect(await snapshot()).toEqual(businessBefore);
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    expect(lines.join('\n')).not.toMatch(/sensitive fixture|private-fixture|synthetic/);
    expect((await run()).counts.security).toBe(0);
  });

  it('purga telemetría vieja y protege claves, hitos, conexiones y eventos desconocidos', async () => {
    const { storeId } = await seed();
    await prisma.productEvent.createMany({ data: [
      { name: 'stock_import_finished', storeId, source: 'client', createdAt: ago(91) },
      { name: 'stock_import_abandoned', source: 'client', createdAt: old },
      { name: 'stock_import_finished', storeId, source: 'client', createdAt: ago(90) },
      { name: 'stock_import_abandoned', source: 'client', createdAt: ago(89) },
      { name: 'stock_import_finished', source: 'client', createdAt: old, dedupeKey: 'preserve' },
      ...['first_sale', 'first_step_completed', 'active_day', 'invite_created', 'invite_accepted', 'unknown'].map(name => ({ name, storeId, source: 'server', createdAt: old })),
    ] });
    expect((await run()).counts.telemetry).toBe(2);
    expect(await prisma.productEvent.count()).toBe(9);
    expect(await prisma.productEvent.findUnique({ where: { dedupeKey: 'preserve' } })).not.toBeNull();
    expect((await run()).counts.telemetry).toBe(0);
  });

  it('solo elimina notificaciones antiguas leídas hace 90 días por todos los miembros activos', async () => {
    const { storeId, userId } = await seed();
    const staff = await prisma.user.create({ data: { firebaseUid: 'staff' } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF' } });
    const removed = await notification(storeId, [userId, staff.id]);
    const keep = [await notification(storeId, [userId]), await notification(storeId, []),
      await notification(storeId, [userId, staff.id], ago(90)),
      await notification(storeId, [userId, staff.id], old, ago(90)),
      await notification(storeId, [userId, staff.id], old, ago(1))];
    const readBefore = await prisma.notificationRead.findMany({ where: { notificationId: { in: keep.map(n => n.id) } }, orderBy: { id: 'asc' } });
    expect((await run()).counts.notifications).toBe(1);
    expect(await prisma.storeNotification.findUnique({ where: { id: removed.id } })).toBeNull();
    expect(await prisma.notificationRead.count({ where: { notificationId: removed.id } })).toBe(0);
    expect(await prisma.notificationRead.findMany({ orderBy: { id: 'asc' } })).toEqual(readBefore);
    expect(await prisma.storeNotification.count()).toBe(keep.length);
  });

  it('un miembro quitado no bloquea la purga y una lectura reciente de un exmiembro la protege', async () => {
    const { storeId, userId } = await seed();
    const staff = await prisma.user.create({ data: { firebaseUid: 'removed' } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF', removedAt: now } });
    await notification(storeId, [userId]);
    const keep = await notification(storeId, [userId]);
    await prisma.notificationRead.create({ data: { notificationId: keep.id, userId: staff.id, readAt: now } });
    expect((await run()).counts.notifications).toBe(1);
    expect(await prisma.storeNotification.findUnique({ where: { id: keep.id } })).not.toBeNull();
  });

  it('respeta tamaño/cantidad de lotes y converge de forma idempotente', async () => {
    const { storeId } = await seed();
    for (let i = 0; i < 7; i++) await audit(storeId);
    const limits = { RETENTION_BATCH_SIZE: '2', RETENTION_MAX_BATCHES: '2' };
    expect((await run(limits)).counts.security).toBe(4);
    expect(await prisma.auditEvent.count()).toBe(3);
    expect((await run(limits)).counts.security).toBe(3);
    expect((await run(limits)).counts.security).toBe(0);
  });

  it('dry-run pagina sin contar dos veces ni modificar padres, lecturas o claves', async () => {
    const { storeId, userId } = await seed();
    for (let i = 0; i < 7; i++) await audit(storeId);
    await notification(storeId, [userId]);
    await prisma.productEvent.create({ data: { name: 'stock_import_abandoned', source: 'client', createdAt: old } });
    const before = { audits: await prisma.auditEvent.findMany(), events: await prisma.productEvent.findMany(),
      notifications: await prisma.storeNotification.findMany(), reads: await prisma.notificationRead.findMany() };
    const config = { RETENTION_DRY_RUN: 'true', RETENTION_BATCH_SIZE: '2', RETENTION_MAX_BATCHES: '2' };
    const lines: string[] = [];
    expect((await run(config, { info: s => { lines.push(s); } })).counts).toEqual({ security: 4, telemetry: 1, notifications: 1 });
    expect((await run(config)).counts.security).toBe(4);
    expect((await run({ ...config, RETENTION_MAX_BATCHES: '5' })).counts.security).toBe(7);
    expect(lines.join('\n')).toContain('"capped":true');
    expect({ audits: await prisma.auditEvent.findMany(), events: await prisma.productEvent.findMany(),
      notifications: await prisma.storeNotification.findMany(), reads: await prisma.notificationRead.findMany() }).toEqual(before);
  });

  it('aplica ampliaciones de plazo en las tres categorías', async () => {
    const { storeId, userId } = await seed();
    await audit(storeId, 'member.removed', 'member', ago(800));
    await notification(storeId, [userId], ago(120), ago(120));
    await prisma.productEvent.create({ data: { name: 'stock_import_finished', source: 'client', createdAt: ago(120) } });
    expect((await run({ RETENTION_SECURITY_DAYS: '1095', RETENTION_TELEMETRY_DAYS: '180', RETENTION_NOTIFICATION_DAYS: '180' })).counts)
      .toEqual({ security: 0, telemetry: 0, notifications: 0 });
    expect((await run()).counts).toEqual({ security: 1, telemetry: 1, notifications: 1 });
  });

  it('otra instancia omite la ejecución mientras el advisory lock está tomado', async () => {
    const { storeId } = await seed();
    await audit(storeId);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${RETENTION_LOCK[0]}::int, ${RETENTION_LOCK[1]}::int)::text`;
      expect((await run()).status).toBe('locked');
      expect(await tx.auditEvent.count()).toBe(1);
    });
    expect((await run()).counts.security).toBe(1);
  });

  it('no espera filas ocupadas y las procesa en la siguiente ejecución', async () => {
    const { storeId } = await seed();
    const busy = await audit(storeId);
    await audit(storeId);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "AuditEvent" WHERE id = ${busy.id} FOR UPDATE`;
      expect((await run()).counts.security).toBe(1);
    });
    expect((await run()).counts.security).toBe(1);
  });

  it('libera el lock ante fallo sin revertir los lotes ya confirmados', async () => {
    const { storeId } = await seed();
    for (let i = 0; i < 3; i++) await audit(storeId);
    await expect(run({ RETENTION_BATCH_SIZE: '1' }, { info(line) {
      if (line.startsWith('Retención lote:')) throw new Error('Fallo sintético del consumidor de logs');
    } })).rejects.toThrow('Fallo sintético');
    expect(await prisma.auditEvent.count()).toBe(2);
    expect((await run()).counts.security).toBe(2);
  });

  it('conserva outbox e idempotencia de reportes aunque sean antiguos', async () => {
    const { storeId } = await seed();
    for (const status of ['SENT', 'PREPARED', 'SENDING', 'UNCERTAIN']) {
      await prisma.periodicReportDelivery.create({ data: { storeId, periodKey: status,
        recipient: 'fixture@example.invalid', status, subject: 'Fixture', html: '', text: '', createdAt: old, updatedAt: old } });
    }
    const before = await prisma.periodicReportDelivery.findMany();
    await run();
    expect(await prisma.periodicReportDelivery.findMany()).toEqual(before);
  });
});
