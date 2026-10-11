import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANUAL_QUOTE_ORDER_ERROR } from '../../lib/manual-quote';
import { StoreForm } from './account';
import { DeskProvider } from '../ui';

const updateStore = vi.hoisted(() => vi.fn());

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    appSession: {
      store: {
        id: 's',
        name: 'Casa',
        taxId: '',
        address: '',
        phone: '2614001122',
        email: 'hola@tienda.test',
        instagram: 'mitienda',
        currency: 'ARS',
        exchangeMode: 'auto',
        exchangeSource: 'blue',
        manualBuy: null,
        manualSell: null,
      },
    },
    updateStore,
  }),
}));

function useViewport(phone: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

function renderStore() {
  const run = vi.fn(async (action: () => Promise<unknown>) => { await action(); });
  render(
    <DeskProvider value={{ tab: 'settings', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <StoreForm run={run} busy={false} error={null} />
    </DeskProvider>,
  );
  return run;
}

async function fillManualQuote(buy: string, sell: string) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByTestId('store-exchange-mode'), 'manual');
  fireEvent.change(screen.getByTestId('store-manual-buy'), { target: { value: buy } });
  fireEvent.change(screen.getByTestId('store-manual-sell'), { target: { value: sell } });
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('store manual quote', () => {
  beforeEach(() => {
    updateStore.mockReset();
  });

  it.each([
    ['desktop', false, 'Datos de la tienda'],
    ['phone', true, 'Tienda'],
  ])('blocks compra 1400 and venta 1300 on %s', async (_label, phone, title) => {
    const restore = useViewport(phone);
    const run = renderStore();

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    await fillManualQuote('1400', '1300');

    expect(screen.getAllByText(MANUAL_QUOTE_ORDER_ERROR)).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    expect(updateStore).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    restore();
  });

  it('saves when the buy rate is lower or equal', async () => {
    const run = renderStore();
    await fillManualQuote('1400', '1400');

    expect(screen.queryByText(MANUAL_QUOTE_ORDER_ERROR)).not.toBeInTheDocument();
    expect(run).toHaveBeenCalled();
    expect(updateStore).toHaveBeenCalledWith(expect.objectContaining({
      exchangeMode: 'manual',
      manualBuy: 1400,
      manualSell: 1400,
    }));
  });

  it('clears the order error when the rates are corrected', async () => {
    renderStore();
    await fillManualQuote('1.400', '1.300');
    expect(screen.getAllByText(MANUAL_QUOTE_ORDER_ERROR)).toHaveLength(2);

    fireEvent.change(screen.getByTestId('store-manual-sell'), { target: { value: '1500' } });
    expect(screen.queryByText(MANUAL_QUOTE_ORDER_ERROR)).not.toBeInTheDocument();
  });
});
