/**
 * Siembra el caso de prueba del agrupado en UNA tienda de test (modelos «AGR ...», para poder limpiarlos).
 *   node dist/scripts/seed-agrupar.js --store-email dueño@mail.com --expect-store-name "iManager PRUEBA"
 *   node dist/scripts/seed-agrupar.js --store-id <id> --expect-store-name "iManager PRUEBA" --clean
 * Solo corre fuera de producción y exige el nombre exacto de la tienda.
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const fail = (message: string, code = 2): never => { console.error(message); process.exit(code); };

let host = '';
try { host = new URL(process.env.DATABASE_URL ?? '').hostname; } catch { /* sin URL válida */ }
if ((process.env.RAILWAY_ENVIRONMENT_NAME ?? '').toLowerCase() === 'production' || host.includes('r-9e') || host.includes('r_9e')) fail('ABORTADO: parece producción. Este seed no corre ahí.', 3);
if (!opt('expect-store-name')) fail('Falta --expect-store-name');

const newId = () => `agr${crypto.randomBytes(10).toString('hex')}`;
const prisma = new PrismaClient();
try {
  const email = opt('store-email'); const id = opt('store-id');
  const stores: { id: string; name: string }[] = id
    ? await prisma.$queryRawUnsafe(`SELECT "id","name" FROM "Store" WHERE "id" = $1`, id)
    : email ? await prisma.$queryRawUnsafe(`SELECT DISTINCT s."id", s."name" FROM "Store" s JOIN "StoreMember" m ON m."storeId" = s."id" AND m."role"::text = 'OWNER' JOIN "User" u ON u."id" = m."userId" WHERE lower(u."email") = lower($1)`, email)
      : fail('Indicá --store-id o --store-email');
  if (stores.length !== 1) fail(`Esperaba 1 tienda y encontré ${stores.length}: ${stores.map(s => `${s.id} «${s.name}»`).join(', ')}`);
  const store = stores[0];
  if (store.name !== opt('expect-store-name')) fail(`El nombre real es «${store.name}», no coincide con --expect-store-name`);

  await prisma.$transaction(async tx => {
    if (flag('clean')) {
      const ids = (await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "InventoryItem" WHERE "storeId" = $1 AND "model" LIKE 'AGR %'`, store.id)).map(r => r.id);
      await tx.$executeRawUnsafe(`DELETE FROM "Sale" WHERE "inventoryItemId" = ANY($1::text[])`, ids);
      await tx.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE "storeId" = $1 AND "entityType" = 'inventory' AND ("entityId" = ANY($2::text[]) OR "entityLabel" LIKE 'AGR %')`, store.id, ids);
      const deleted = await tx.$executeRawUnsafe(`DELETE FROM "InventoryItem" WHERE "id" = ANY($1::text[])`, ids);
      console.log(`Limpieza: ${deleted} filas AGR borradas de «${store.name}»`);
      return;
    }
    const [{ n }] = await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "InventoryItem" WHERE "storeId" = $1 AND "model" LIKE 'AGR %'`, store.id);
    if (n) throw new Error(`Ya hay ${n} filas AGR; corré --clean primero`);
    type Over = Partial<{ model: string; capacity: string; color: string; condition: string; grade: string; batteryHealth: string; cost: number; price: number | null; status: string; quantity: number; imei: string | null; reservedClientId: string | null }>;
    const base = { model: 'AGR iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 400, price: 550 as number | null, status: 'DISPONIBLE', quantity: 1, imei: null as string | null, reservedClientId: null as string | null };
    const t0 = Date.now() - 3_600_000; let tick = 0; const made: Record<string, string[]> = {};
    const ins = async (tag: string, count: number, over: Over = {}, perRow: (i: number) => Over = () => ({})) => {
      made[tag] = [];
      for (let i = 0; i < count; i++) {
        const r = { ...base, ...over, ...perRow(i) }; const rid = newId(); made[tag].push(rid);
        await tx.$executeRawUnsafe(`INSERT INTO "InventoryItem" ("id","storeId","imei","model","capacity","color","condition","grade","batteryHealth","cost","price","currency","quantity","status","reservedClientId","createdAt","updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::numeric,$11::numeric,'USD',$12,$13,$14,$15,$15)`,
          rid, store.id, r.imei, r.model, r.capacity, r.color, r.condition, r.grade, r.batteryHealth, r.cost, r.price, r.quantity, r.status, r.reservedClientId, new Date(t0 + 1000 * tick++));
      }
    };
    await ins('A_100_identicas', 100);
    await ins('B_20_color_blanco', 20, { color: 'Blanco' });
    await ins('C_5_precio_560', 5, { price: 560 });
    await ins('D_10_con_imei', 10, {}, i => ({ imei: `35${String(900000000000 + i).padStart(13, '0')}` }));
    await ins('E1_bateria_85', 1, { batteryHealth: '85%' });
    await ins('E2_costo_410', 1, { cost: 410 });
    await ins('F_4_una_con_venta', 4, { model: 'AGR iPhone 12' });
    await ins('G_3_una_reservada', 3, { model: 'AGR iPhone 12 Pro' }, i => (i === 1 ? { reservedClientId: 'cliente-falso' } : {}));
    await ins('H_6_una_editada', 6, { model: 'AGR iPhone 11' });
    await ins('I_2_con_cantidad_previa', 2, { model: 'AGR iPhone SE' }, i => ({ quantity: i === 0 ? 3 : 5 }));
    await ins('J_2_archivadas', 2, { model: 'AGR iPhone X' });
    await ins('K_3_en_revision', 3, { model: 'AGR iPhone XR', status: 'EN_REVISION', price: null });
    await tx.$executeRawUnsafe(`UPDATE "InventoryItem" SET "archivedAt" = now() WHERE "id" = ANY($1::text[])`, made.J_2_archivadas);
    await tx.$executeRawUnsafe(`INSERT INTO "Sale" ("id","storeId","inventoryItemId","dateLabel","amount","paymentMethod","status","soldAt","updatedAt") VALUES ($1,$2,$3,'hoy',550,'EFECTIVO','COMPLETADA',now(),now())`, newId(), store.id, made.F_4_una_con_venta[2]);
    await tx.$executeRawUnsafe(`INSERT INTO "AuditEvent" ("id","storeId","actorName","action","entityType","entityId","entityLabel","source") VALUES ($1,$2,'seed','inventory.price','inventory',$3,'AGR iPhone 11','manual')`, newId(), store.id, made.H_6_una_editada[3]);
    const [tot] = await tx.$queryRawUnsafe<{ filas: number; unidades: number }[]>(`SELECT count(*)::int AS filas, sum("quantity")::int AS unidades FROM "InventoryItem" WHERE "storeId" = $1 AND "model" LIKE 'AGR %'`, store.id);
    console.log(`Sembrado en «${store.name}»:`, JSON.stringify(Object.fromEntries(Object.entries(made).map(([k, v]) => [k, v.length]))), JSON.stringify(tot));
  }, { timeout: 300_000, maxWait: 30_000 });
} catch (cause) {
  console.error('ERROR:', cause instanceof Error ? cause.message : 'desconocido');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
