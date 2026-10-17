import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextDailyReprice, startDailyReprice } from './reprice-schedule.js';

afterEach(() => { vi.useRealTimers(); });

describe('horario de la actualización diaria', () => {
  it('elige las 06:00 de Argentina, antes de la ventana habitual de débitos', () => {
    expect(nextDailyReprice(new Date('2026-10-17T08:30:00Z')).toISOString()).toBe('2026-10-17T09:00:00.000Z');
    expect(nextDailyReprice(new Date('2026-10-17T09:00:00Z')).toISOString()).toBe('2026-10-18T09:00:00.000Z');
    expect(nextDailyReprice(new Date('2026-10-17T09:00:01Z')).toISOString()).toBe('2026-10-18T09:00:00.000Z');
    expect(nextDailyReprice(new Date('2026-10-17T02:30:00Z')).toISOString()).toBe('2026-10-17T09:00:00.000Z');
  });

  it('fuera de producción no programa nada', () => {
    vi.useFakeTimers();
    const log = { info: vi.fn(), warn: vi.fn() };
    const run = vi.fn(async () => undefined);
    const stop = startDailyReprice(log, { enabled: false, run });
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(log.info).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    stop();
  });

  it('dispara una corrida al llegar las 06:00 y rearma el día siguiente', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T08:00:00Z'));
    const log = { info: vi.fn(), warn: vi.fn() };
    const run = vi.fn(async () => undefined);
    const stop = startDailyReprice(log, { enabled: true, run });
    expect(log.info).toHaveBeenCalledWith('Facturación diaria programada para las 06:00, hora de Argentina.');
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });
});
