import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const dispatch = vi.hoisted(() => vi.fn());
vi.mock('./service.js', () => ({ runDueReportsLocked: dispatch }));
import { registerPeriodicReportTimer, REPORT_INTERVAL_MS, startPeriodicReportTimer } from './timer.js';

const log = { info: vi.fn(), warn: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  dispatch.mockResolvedValue(0);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('timer de reportes de la API', () => {
  it.each([undefined, 'false', 'TRUE', '1'])('no programa envíos con REPORT_MAIL_ENABLED=%s', async value => {
    vi.stubEnv('REPORT_MAIL_ENABLED', value);
    const stop = startPeriodicReportTimer(log);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2);
    expect(dispatch).not.toHaveBeenCalled();
    await stop();
  });

  it('ejecuta el mismo despachador con lock cada cinco minutos y cancela al parar', async () => {
    vi.stubEnv('REPORT_MAIL_ENABLED', 'true');
    const stop = startPeriodicReportTimer(log);
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS - 1);
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).toHaveBeenCalledWith(log);
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS);
    expect(dispatch).toHaveBeenCalledTimes(2);
    await stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('no superpone corridas y espera el envío activo al cerrar Fastify', async () => {
    vi.stubEnv('REPORT_MAIL_ENABLED', 'true');
    let finish!: () => void;
    dispatch.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const app = Fastify();
    registerPeriodicReportTimer(app);
    expect(vi.getTimerCount()).toBe(0);
    await app.ready();
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 3);
    expect(dispatch).toHaveBeenCalledTimes(1);
    let closed = false;
    const closing = app.close().then(() => { closed = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(closed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    finish();
    await closing;
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('registra el fallo sin rechazos sin manejar y reintenta en el siguiente intervalo', async () => {
    vi.stubEnv('REPORT_MAIL_ENABLED', 'true');
    dispatch.mockRejectedValueOnce(new Error('database unavailable'));
    const stop = startPeriodicReportTimer(log);
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(2);
    await stop();
  });
});
