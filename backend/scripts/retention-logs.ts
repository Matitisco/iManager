import { runLogRetention } from '../src/modules/retention/service.js';

// Intentionally independent of the HTTP server, Firebase and dotenv files.
// Cron/service supplies DATABASE_URL through its existing protected environment.
try {
  await runLogRetention();
} catch {
  // Prisma/Zod/URL errors can include credentials or row contents. Never serialize them.
  console.error('Retención: ejecución fallida. Revisá configuración/conectividad; pueden existir lotes ya confirmados.');
  process.exitCode = 1;
}
