// TEMPORAL, solo entorno test: corre seed -> dry-run -> apply -> verificación sobre «iManager PRUEBA» y deja la salida en los logs.
// Se revierte apenas termina la prueba. No hace nada fuera de RAILWAY_ENVIRONMENT_NAME=test.
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const NAME = 'iManager PRUEBA';
if ((process.env.RAILWAY_ENVIRONMENT_NAME ?? '') !== 'test') { console.log('[agrupar-job] no es el entorno test: no hago nada.'); process.exit(0); }
const prisma = new PrismaClient();
const run = (script: string, extra: string[]) => {
  console.log(`\n[agrupar-job] $ ${script} ${extra.join(' ')}`);
  const r = spawnSync('node', [`dist/scripts/${script}.js`, ...extra], { encoding: 'utf8', timeout: 240_000 });
  console.log(r.stdout); if (r.stderr) console.log(r.stderr);
  return r.status;
};
try {
  const stores = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(`SELECT "id","name" FROM "Store" WHERE "name" = $1`, NAME);
  console.log(`[agrupar-job] tiendas «${NAME}»: ${stores.length}`);
  if (stores.length === 0) {
    const all = await prisma.$queryRawUnsafe<{ id: string; name: string; items: number }[]>(`SELECT s."id", s."name", (SELECT count(*)::int FROM "InventoryItem" i WHERE i."storeId" = s."id") AS items FROM "Store" s ORDER BY s."name" LIMIT 50`);
    for (const s of all) console.log(`[agrupar-job] tienda en test: ${s.id} «${s.name}» (${s.items} equipos)`);
  }
  if (stores.length === 1) {
    const base = ['--store-id', stores[0].id];
    const seeded = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "InventoryItem" WHERE "storeId" = $1 AND "model" LIKE 'AGR %'`, stores[0].id);
    console.log(`[agrupar-job] filas AGR existentes: ${seeded[0].n}`);
    if (seeded[0].n === 0) {
      console.log('[agrupar-job] === SEED ===');
      run('seed-agrupar', [...base, '--expect-store-name', NAME]);
      console.log('[agrupar-job] === DRY-RUN ===');
      run('agrupar-repetidos', base);
      console.log('[agrupar-job] === APPLY ===');
      run('agrupar-repetidos', [...base, '--apply', '--expect-store-name', NAME, '--backup-dir', '/tmp/agrupar-backups']);
      console.log('[agrupar-job] === DRY-RUN POST (debe decir 0 grupos) ===');
      run('agrupar-repetidos', base);
      const rows = await prisma.$queryRawUnsafe<{ model: string; color: string; price: string | null; status: string; imei: string | null; archived: boolean; cantidad: number }[]>(
        `SELECT "model","color","price"::text AS price,"status","imei","archivedAt" IS NOT NULL AS archived,"quantity"::int AS cantidad FROM "InventoryItem" WHERE "storeId" = $1 AND "model" LIKE 'AGR %' AND "imei" IS NULL ORDER BY "model","color","price" NULLS LAST,"quantity" DESC`, stores[0].id);
      console.log('[agrupar-job] === FILAS FINALES SIN IMEI ===');
      for (const r of rows) console.log(`  ${r.model} | ${r.color} | precio ${r.price ?? '-'} | ${r.status}${r.archived ? ' (archivada)' : ''} | cantidad ${r.cantidad}`);
      const tot = await prisma.$queryRawUnsafe<{ filas: number; unidades: number }[]>(`SELECT count(*)::int AS filas, sum("quantity")::int AS unidades FROM "InventoryItem" WHERE "storeId" = $1 AND "model" LIKE 'AGR %'`, stores[0].id);
      console.log(`[agrupar-job] TOTAL AGR: ${JSON.stringify(tot[0])} (esperado: 25 filas / 163 unidades)`);
    }
  }
} catch (cause) {
  console.log('[agrupar-job] ERROR', cause instanceof Error ? cause.message : 'desconocido');
} finally {
  await prisma.$disconnect();
}
