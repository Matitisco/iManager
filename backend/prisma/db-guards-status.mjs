// Logs whether the #763 post-push guards exist. Read-only; never fails startup.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM pg_indexes WHERE indexname = 'Consignment_pending_item_key') AS "index",
      (SELECT COUNT(*)::int FROM pg_constraint
        WHERE conrelid = to_regclass('public."Consignment"') AND contype = 'c') AS "checks"`);
  console.log(
    `db-guards #763: pending_item_key=${row.index} checks=${row.checks}`,
  );
} catch (error) {
  console.warn(
    `db-guards #763: status unavailable (${error?.code ?? 'error'})`,
  );
} finally {
  await prisma.$disconnect();
}
