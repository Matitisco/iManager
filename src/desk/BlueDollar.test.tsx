import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlueDollar } from './BlueDollar';
import { ExchangeProvider } from './exchange';
import { BLUE_REFRESH_MS, BLUE_STORAGE_KEY, argentinaDay, shiftDay } from './blue-rate';
import { formatMoney } from './format';

function renderWidget(variant?: 'chip') {
  return render(
    <ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'auto', exchangeSource: 'blue', manualBuy: null, manualSell: null }}>
      <BlueDollar variant={variant} />
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
    expect(screen.queryByTestId('blue-mode')).not.toBeInTheDocument();
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

  it('opens the same sheet from the compact phone chip', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', mockRates());
    renderWidget('chip');
    const widget = screen.getByTestId('blue-widget');
    expect(widget).toHaveAttribute('data-variant', 'chip');
    expect(widget).toHaveAttribute('data-state', 'loading');
    expect(widget).toHaveAttribute('data-mode', 'auto');
    expect(widget.querySelectorAll('.dolar-skel')).toHaveLength(2);
    expect(widget).not.toHaveTextContent(formatMoney(1280));
    await waitFor(() => expect(widget).toHaveAttribute('data-state', 'ready'));
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(widget).toHaveTextContent(formatMoney(1280));
    expect(widget).toHaveTextContent(formatMoney(1300));
    await user.click(screen.getByRole('button', { name: 'Dólar blue' }));
    expect(screen.getByRole('heading', { name: 'Dólar blue' })).toBeInTheDocument();
    expect(screen.getByTestId('blue-mode')).toHaveTextContent('Automática');
    expect(screen.getByTestId('blue-refresh-now')).toHaveTextContent('Actualizar');
    expect(screen.getByTestId('blue-overlay')).toBeInTheDocument();
  });

  it('keeps the last sell price on the phone chip and retries', async () => {
    const user = userEvent.setup();
    const today = argentinaDay(new Date());
    localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify({
      source: 'dolarapi',
      quotes: {},
      days: {},
      houses: {
        blue: {
          quote: { buy: 1280, sell: 1300, updatedAt, fetchedAt: new Date(Date.now() - BLUE_REFRESH_MS - 1000).toISOString() },
          days: { [shiftDay(today, -1)]: { buy: 1290, sell: 1290 }, [today]: { buy: 1280, sell: 1300 } },
        },
      },
    }));
    const fetchMock = vi.fn(async (): Promise<ReturnType<typeof json>> => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    renderWidget('chip');

    expect(await screen.findByTestId('blue-retry')).toBeInTheDocument();
    const widget = screen.getByTestId('blue-widget');
    expect(widget).toHaveAttribute('data-state', 'error');
    expect(widget).toHaveAttribute('data-quote', 'stale');
    expect(widget).toHaveTextContent(formatMoney(1300));
    expect(widget).toHaveTextContent('21:40');
    expect(widget).not.toHaveTextContent(formatMoney(1280));
    expect(screen.getByTestId('blue-toast')).toHaveTextContent('No pudimos actualizar el dólar. Mostramos el de las 21:40.');

    await user.click(screen.getByRole('button', { name: 'Dólar blue' }));
    expect(screen.getByTestId('blue-alert')).toHaveTextContent('Mostramos el dato de las 21:40');

    fetchMock.mockImplementation(async () => json(dolar));
    await user.click(screen.getByTestId('blue-retry'));
    await waitFor(() => expect(widget).toHaveAttribute('data-state', 'ready'));
    expect(screen.queryByTestId('blue-toast')).not.toBeInTheDocument();
  });

  it('says there is no quote when the phone chip never received one', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    renderWidget('chip');
    expect(await screen.findByText('sin dato')).toBeInTheDocument();
    expect(screen.getByTestId('blue-widget')).toHaveAttribute('data-quote', 'none');
    expect(screen.getByTestId('blue-toast')).toHaveTextContent('No pudimos actualizar el dólar.');
    await user.click(screen.getByRole('button', { name: 'Dólar blue' }));
    expect(screen.getByTestId('blue-alert')).toHaveTextContent('No hay cotización');
    expect(screen.queryByTestId('blue-status')).not.toBeInTheDocument();
  });

  it('shows a manual store quote on the phone chip without refreshing', async () => {
    const user = userEvent.setup();
    render(
      <ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1100, manualSell: 1150 }}>
        <BlueDollar variant="chip" />
      </ExchangeProvider>,
    );
    const widget = screen.getByTestId('blue-widget');
    expect(widget).toHaveAttribute('data-state', 'ready');
    expect(widget).toHaveAttribute('data-mode', 'manual');
    expect(widget).toHaveTextContent('Dólar');
    expect(widget).toHaveTextContent(formatMoney(1100));
    expect(widget).toHaveTextContent(formatMoney(1150));
    expect(screen.queryByTestId('blue-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blue-toast')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dólar' }));
    expect(screen.getByTestId('blue-mode')).toHaveTextContent('Manual');
    expect(screen.getByText('Cotización cargada por la tienda.')).toBeInTheDocument();
    expect(screen.queryByTestId('blue-refresh-now')).not.toBeInTheDocument();
  });

  it('asks to configure a manual quote when the store has none', async () => {
    const user = userEvent.setup();
    render(
      <ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'oficial', manualBuy: null, manualSell: null }}>
        <BlueDollar variant="chip" />
      </ExchangeProvider>,
    );
    const widget = screen.getByTestId('blue-widget');
    expect(widget).toHaveAttribute('data-state', 'error');
    expect(widget).toHaveAttribute('data-mode', 'manual');
    expect(widget).toHaveTextContent('sin dato');
    expect(screen.queryByTestId('blue-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blue-toast')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dólar' }));
    expect(screen.getByTestId('blue-alert')).toHaveTextContent('Cargá la cotización en Configuración.');
  });
});
