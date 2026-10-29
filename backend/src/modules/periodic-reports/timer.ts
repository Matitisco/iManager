import type { FastifyInstance } from 'fastify';
import { runDueReportsLocked } from './service.js';

export const REPORT_INTERVAL_MS = 5 * 60 * 1000;
type Log = { info: (message: string) => void; warn: (message: string) => void };

export function startPeriodicReportTimer(log: Log) {
  if (process.env.REPORT_MAIL_ENABLED !== 'true') return async () => {};

  let stopped = false;
  let running: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (stopped || running) return;
    running = Promise.resolve()
      .then(() => runDueReportsLocked(log))
      .then(() => undefined)
      .catch(() => { log.warn('Reporte automático: falló la ejecución programada.'); })
      .finally(() => { running = undefined; });
  }, REPORT_INTERVAL_MS);
  timer.unref?.();
  log.info('Reporte automático: revisión de envíos programada cada cinco minutos.');

  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}

export function registerPeriodicReportTimer(app: FastifyInstance) {
  let stop: (() => Promise<void>) | undefined;
  app.addHook('onReady', async () => { stop = startPeriodicReportTimer(app.log); });
  app.addHook('onClose', async () => { await stop?.(); });
}
