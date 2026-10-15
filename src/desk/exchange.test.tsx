import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLUE_REFRESH_MS, BLUE_STORAGE_KEY, readBlueState } from './blue-rate';
import { ExchangeProvider, useExchange, type StoreExchange } from './exchange';

const automatic: StoreExchange = {
  currency: 'ARS', exchangeMode: 'auto', exchangeSource: 'blue', manualBuy: null, manualSell: null,
};
const manual: StoreExchange = { ...automatic, exchangeMode: 'manual', manualBuy: 1100, manualSell: 1150 };
const dolar = { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function Quote() {
  const { phase, quote, refresh } = useExchange();
  return <button onClick={refresh}>{phase}:{quote?.sell ?? 'none'}</button>;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('exchange request lifecycle', () => {
  it.each(['quote', 'previous close'])('aborts the pending %s fetch and clears timers on unmount', async (stage) => {
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (stage === 'previous close' && fetchMock.mock.calls.length === 1) return Promise.resolve(json(dolar));
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal?.reason), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ExchangeProvider settings={automatic}><Quote /></ExchangeProvider>);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'quote' ? 1 : 2);
    expect(signal?.aborted).toBe(false);

    await act(async () => { view.unmount(); });
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(localStorage.getItem(BLUE_STORAGE_KEY)).toBeNull();
    await vi.advanceTimersByTimeAsync(BLUE_REFRESH_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'quote' ? 1 : 2);
  });

  it.each(['quote', 'previous close'])('ignores a late %s response even when fetch ignores cancellation', async (stage) => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => {
      if (stage === 'previous close' && fetchMock.mock.calls.length === 1) return Promise.resolve(json(dolar));
      return pending.promise;
    });
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ExchangeProvider settings={automatic}><Quote /></ExchangeProvider>);
    await act(async () => {});
    view.unmount();

    await act(async () => {
      pending.resolve(json(stage === 'quote' ? dolar : { venta: '1300,00', valor_cierre_ant: '1290,00' }));
    });
    expect(localStorage.getItem(BLUE_STORAGE_KEY)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'quote' ? 1 : 2);
  });

  it.each(['success', 'failure'])('keeps the manual quote after the old request settles with %s', async (outcome) => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ExchangeProvider settings={automatic}><Quote /></ExchangeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('loading:none');
    view.rerender(<ExchangeProvider settings={manual}><Quote /></ExchangeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('ready:1150');

    await act(async () => {
      if (outcome === 'success') pending.resolve(json(dolar));
      else pending.reject(new Error('request failed after cleanup'));
    });
    expect(screen.getByRole('button')).toHaveTextContent('ready:1150');
    expect(vi.getTimerCount()).toBe(0);
    expect(localStorage.getItem(BLUE_STORAGE_KEY)).toBeNull();
  });

  it('keeps the new source when an older response arrives last', async () => {
    const pending = deferred<Response>();
    let oldSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blue')) {
        oldSignal = init?.signal ?? undefined;
        return pending.promise;
      }
      return Promise.resolve(json({ ...dolar, venta: 1000 }));
    }));
    const view = render(<ExchangeProvider settings={automatic}><Quote /></ExchangeProvider>);
    await act(async () => {
      view.rerender(<ExchangeProvider settings={{ ...automatic, exchangeSource: 'oficial' }}><Quote /></ExchangeProvider>);
    });
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.getByRole('button')).toHaveTextContent('ready:1000');
    await act(async () => { pending.resolve(json(dolar)); });
    expect(screen.getByRole('button')).toHaveTextContent('ready:1000');
    expect(readBlueState().houses.blue).toBeUndefined();
    expect(readBlueState().houses.oficial?.quote.sell).toBe(1000);
  });

  it('aborts a superseded refresh and still refreshes after StrictMode effect replay', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init!.signal!;
      signals.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }));
    const view = render(<StrictMode><ExchangeProvider settings={automatic}><Quote /></ExchangeProvider></StrictMode>);
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    fireEvent.click(screen.getByRole('button'));
    expect(signals).toHaveLength(3);
    expect(signals[1].aborted).toBe(true);
    expect(signals[2].aborted).toBe(false);
    await act(async () => { view.unmount(); });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
