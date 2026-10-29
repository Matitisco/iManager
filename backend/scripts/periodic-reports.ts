// Optional one-shot entrypoint; the API timer is the recommended scheduler.
import '../src/config/env.js';
import { prisma } from '../src/plugins/prisma.js';
import { runDueReportsLocked } from '../src/modules/periodic-reports/service.js';
try {
  if (process.env.REPORT_MAIL_ENABLED !== 'true') console.info('Reporte automático: worker desactivado.');
  else await runDueReportsLocked();
} finally { await prisma.$disconnect(); }
