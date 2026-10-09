import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BLUE_SOURCES,
  BLUE_STORAGE_KEY,
  argentinaDay,
  convertUsd,
  formatClock,
  parseArAmount,
  parseBlueQuote,
  previousCloseFromAmbito,
  readBlueState,
  refreshBlueQuote,
  sellDelta,
  shiftDay,
} from './blue-rate';

function json(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body };
}

const dolar = { compra: 1530, venta: 1550, fechaActualizacion: '2026-10-08T21:40:00-03:00' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('blue dollar quote', () => {
  it('keeps the public sources that expose a free blue quote', () => {
    expect(BLUE_SOURCES.map((item) => item.label)).toEqual(['DolarApi', 'Bluelytics']);
    expect(BLUE_SOURCES.some((item) => item.url.includes('dolarhoy'))).toBe(false);
  });

  it('parses DolarApi and Bluelytics payloads', () => {
    expect(parseBlueQuote('dolarapi', dolar)).toMatchObject({ source: 'dolarapi', buy: 1530, sell: 1550 });
    expect(parseBlueQuote('bluelytics', {
      blue: { value_buy: '1517.00', value_sell: 1550 },
      last_update: '2026-10-08T13:30:53.866256-03:00',
    })).toMatchObject({ source: 'bluelytics', buy: 1517, sell: 1550 });
  });

  it('rejects an empty or incomplete payload', () => {
    expect(() => parseBlueQuote('dolarapi', null)).toThrow('Cotización inválida');
    expect(() => parseBlueQuote('dolarapi', { compra: 0, venta: 10, fechaActualizacion: '2026-10-08T00:00:00Z' })).toThrow('Cotización inválida');
    expect(() => parseBlueQuote('bluelytics', { last_update: '2026-10-08T00:00:00Z' })).toThrow('Cotización inválida');
  });

  it('reads the previous close only when Ámbito matches the live sell', () => {
    const ambito = { venta: '1.550,00', valor_cierre_ant: '1555,00' };
    expect(parseArAmount('1.550,00')).toBe(1550);
    expect(previousCloseFromAmbito(1550, ambito)).toBe(1555);
    expect(previousCloseFromAmbito(1400, ambito)).toBeNull();
    expect(previousCloseFromAmbito(1550, { venta: '1550,00' })).toBeNull();
  });

  it('formats the quote clock in Argentina and compares the previous sell', () => {
    expect(formatClock('2026-10-08T21:40:00-03:00')).toBe('21:40');
    expect(argentinaDay(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07');
    expect(argentinaDay(new Date('2026-10-08T03:30:00Z'))).toBe('2026-10-08');
    const today = argentinaDay(new Date('2026-10-08T15:00:00Z'));
    expect(sellDelta(1550, { [shiftDay(today, -1)]: { buy: 1530, sell: 1555 } }, new Date('2026-10-08T15:00:00Z'))).toBe(-5);
    expect(sellDelta(1550, {}, new Date('2026-10-08T15:00:00Z'))).toBeNull();
    expect(convertUsd(500, 1300)).toBe(650000);
    expect(convertUsd(0, 1300)).toBe(0);
  });

  it('stores the last quote and skips the previous-close lookup once a prior day exists', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('dolarapi.com')) return json(dolar);
      if (href.includes('ambito.com')) return json({ venta: '1550,00', valor_cierre_ant: '1540,00' });
      throw new Error(href);
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await refreshBlueQuote('dolarapi');
    expect(first.quote.sell).toBe(1550);
    expect(sellDelta(first.quote.sell, first.days)).toBe(10);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('ambito.com'))).toBe(true);

    fetchMock.mockClear();
    const second = await refreshBlueQuote('dolarapi');
    expect(second.quote.buy).toBe(1530);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('ambito.com'))).toBe(false);
    expect(readBlueState().quotes.dolarapi?.sell).toBe(1550);
  });

  it('leaves the saved quote untouched when the source fails', async () => {
    localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify({
      source: 'dolarapi',
      quotes: { dolarapi: { buy: 10, sell: 12, updatedAt: '2026-10-08T21:40:00-03:00', fetchedAt: '2026-10-08T21:40:00-03:00' } },
      days: {},
    }));
    vi.stubGlobal('fetch', vi.fn(async () => json({}, false)));
    await expect(refreshBlueQuote('dolarapi')).rejects.toThrow('No se pudo actualizar');
    expect(readBlueState().quotes.dolarapi?.sell).toBe(12);
  });

  it('ignores a broken cache', () => {
    localStorage.setItem(BLUE_STORAGE_KEY, '{');
    expect(readBlueState().source).toBe('dolarapi');
    localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify({ source: 'dolar-hoy', quotes: { dolarapi: { buy: 'x' } } }));
    expect(readBlueState()).toEqual({ source: 'dolarapi', quotes: {}, days: {} });
  });
});
