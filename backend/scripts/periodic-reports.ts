// One-shot cron entrypoint. Schedule */5 * * * * UTC after manual activation.
import '../src/config/env.js';
import { prisma } from '../src/plugins/prisma.js';
import { runDueReportsLocked } from '../src/modules/periodic-reports/service.js';
try {
  if (process.env.REPORT_MAIL_ENABLED !== 'true') console.info('Reporte automático: worker desactivado.');
  else await runDueReportsLocked();
} finally { await prisma.$disconnect(); }
