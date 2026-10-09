import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlueDollar } from './BlueDollar';
import { ExchangeProvider } from './exchange';
import { BLUE_REFRESH_MS, BLUE_STORAGE_KEY, argentinaDay, shiftDay } from './blue-rate';
import { formatMoney } from './format';

function renderWidget() {
  return render(
    <ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'auto', exchangeSource: 'blue', manualBuy: null, manualSell: null }}>
      <BlueDollar />
    </ExchangeProvider>,
  );
}

function json(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body };
}

const updatedAt = '2026-10-08T21:40:00-03:00';
const dolar = { compra: 1280, venta: 1300, fechaActualizacion: updatedAt };
const ambito = { venta: '1300,00', valor_cierre_ant: '1290,00' };
const bluelytics = { blue: { value_buy: 1270, value_sell: 1290 }, last_update: '2026-10-08T21:10:00-03:00' };

function mockRates(fail = false) {
  return vi.fn(async (url: RequestInfo | URL) => {
    if (fail) throw new Error('offline');
    const href = String(url);
    if (href.includes('dolarapi.com')) return json(dolar);
    if (href.includes('bluelytics')) return json(bluelytics);
    if (href.includes('ambito.com')) return json(ambito);
    throw new Error(href);
  });
}

function seedFresh() {
  const today = argentinaDay(new Date());
  localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify({
    source: 'dolarapi',
    quotes: {
      dolarapi: { buy: 1280, sell: 1300, updatedAt, fetchedAt: new Date().toISOString() },
    },
    days: {
      dolarapi: {
        [shiftDay(today, -1)]: { buy: 1290, sell: 1290 },
        [today]: { buy: 1280, sell: 1300 },
      },
    },
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('blue dollar widget', () => {
  it('shows a loading state and then the live quote', async () => {
    vi.stubGlobal('fetch', mockRates());
    renderWidget();
    expect(screen.getByTestId('blue-widget')).toHaveAttribute('data-state', 'loading');
    expect(screen.getByText('Actualizando...')).toBeInTheDocument();
    expect(await screen.findByText(/Act\. 21:40 · DolarApi/)).toBeInTheDocument();
    expect(screen.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');
    expect(screen.getByTestId('blue-widget')).toHaveTextContent(formatMoney(1280));
    expect(screen.getByTestId('blue-widget')).toHaveTextContent(formatMoney(1300));
    expect(screen.getByTestId('blue-widget').querySelector('svg[data-icon="dolar"]')).toBeTruthy();
  });

  it('opens the detail with the calculator, source switch and close actions', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', mockRates());
    renderWidget();
    await screen.findByText(/Act\. 21:40/);
    await user.click(screen.getByRole('button', { name: /Dólar blue/ }));

    expect(screen.getByRole('heading', { name: 'Dólar blue' })).toBeInTheDocument();
    expect(screen.getByText('Fuente: DolarApi (cotización blue).')).toBeInTheDocument();
    expect(screen.getByText(/se refresca cada 15 min/)).toBeInTheDocument();
    expect(screen.getByText(`▲ ${formatMoney(10)}`)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Dólares'), '500');
    expect(screen.getByTestId('blue-result')).toHaveTextContent(formatMoney(650000));
    await user.click(screen.getByTestId('blue-rate-side'));
    expect(screen.getByTestId('blue-rate-side')).toHaveTextContent('al precio de compra');
    expect(screen.getByTestId('blue-result')).toHaveTextContent(formatMoney(640000));

    await user.click(screen.getByTestId('blue-done'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Dólar blue/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the last quote and retries from the error state', async () => {
    const user = userEvent.setup();
    const today = argentinaDay(new Date());
    localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify({
      source: 'dolarapi',
      quotes: {
        dolarapi: {
          buy: 1280,
          sell: 1300,
          updatedAt,
          fetchedAt: new Date(Date.now() - BLUE_REFRESH_MS - 1000).toISOString(),
        },
      },
      days: { dolarapi: { [shiftDay(today, -1)]: { buy: 1290, sell: 1290 }, [today]: { buy: 1280, sell: 1300 } } },
    }));
    const fetchMock = vi.fn(async (): Promise<ReturnType<typeof json>> => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWidget();

    expect(await screen.findByTestId('blue-retry')).toBeInTheDocument();
    expect(screen.getByTestId('blue-widget')).toHaveAttribute('data-state', 'error');
    expect(screen.getByTestId('blue-widget')).toHaveTextContent(formatMoney(1280));
    expect(screen.getByTestId('blue-widget')).toHaveTextContent(formatMoney(1300));
    expect(screen.getByTestId('blue-widget')).toHaveTextContent('No pudimos actualizar. Mostramos el dato de las 21:40');

    fetchMock.mockImplementation(async () => json(dolar));
    await user.click(screen.getByTestId('blue-retry'));
    expect(await screen.findByText(/Act\. 21:40 · DolarApi/)).toBeInTheDocument();
    expect(screen.getByTestId('blue-widget')).toHaveAttribute('data-state', 'ready');
  });

  it('does not refetch a fresh cached quote until asked', async () => {
    const user = userEvent.setup();
    seedFresh();
    let release: (() => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<ReturnType<typeof json>>((resolve) => {
      release = () => resolve(json(dolar));
    }));
    vi.stubGlobal('fetch', fetchMock);
    renderWidget();
    expect(screen.getByText(/Act\. 21:40 · DolarApi/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());

    await user.click(screen.getByTestId('blue-refresh'));
    expect(screen.getByText('Actualizando...')).toBeInTheDocument();
    expect(screen.getByTestId('blue-widget')).toHaveAttribute('data-state', 'loading');
    release?.();
    expect(await screen.findByText(/Act\. 21:40 · DolarApi/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
