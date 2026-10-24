import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANUAL_QUOTE_ORDER_ERROR } from '../lib/manual-quote';
import { Onboarding } from './Onboarding';

const mockAppContext = vi.hoisted(() => ({
  appSession: {
    user: {
      id: 'user-1',
      displayName: 'Mati Test',
      email: 'mati@imanager.test',
      avatarUrl: '',
    },
  },
  completeOnboarding: vi.fn(),
  acceptStoreInvitation: vi.fn(),
  logout: vi.fn(),
}));

const mockInvitationState = vi.hoisted(() => ({
  preview: null,
  invalid: false,
  error: null,
  isLoading: false,
  isRetrying: false,
  retryAttempt: 0,
  reload: vi.fn(),
}));

vi.mock('../desk/exchange', () => ({
  ExchangeProvider: ({ children }: { children: React.ReactNode }) => children,
  useExchange: () => ({ settings: { currency: 'USD', exchangeMode: 'auto', exchangeSource: 'blue' }, money: { rate: 1555 }, phase: 'ready' }),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockAppContext,
}));

vi.mock('../hooks/useInvitationPreview', () => ({
  useInvitationPreview: () => mockInvitationState,
}));

describe('Onboarding', () => {
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const scroll = vi.fn();
  beforeEach(() => {
    scroll.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    mockAppContext.completeOnboarding.mockReset();
    mockAppContext.acceptStoreInvitation.mockReset();
    mockAppContext.logout.mockReset();
    mockInvitationState.preview = null;
    mockInvitationState.invalid = false;
    mockInvitationState.error = null;
    mockInvitationState.isLoading = false;
    mockInvitationState.isRetrying = false;
    mockInvitationState.reload.mockReset();
  });
  afterEach(() => {
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('does not render placeholder hash links', () => {
    const { container } = render(<Onboarding />);
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });

  it('starts empty instead of suggesting the account name or email', () => {
    render(<Onboarding />);

    const input = screen.getByLabelText('Nombre de la tienda');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'iManager Store');
  });

  it('asks for a store name before calling the backend', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const input = screen.getByLabelText('Nombre de la tienda');
    expect(input).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText('Completá el nombre de la tienda')).toBeInTheDocument();
    expect(mockAppContext.completeOnboarding).not.toHaveBeenCalled();

    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText('Completá el nombre de la tienda')).toBeInTheDocument();
    expect(mockAppContext.completeOnboarding).not.toHaveBeenCalled();
  });

  it('keeps the store name empty when the invitation is invalid', () => {
    mockInvitationState.invalid = true;
    render(<Onboarding inviteToken="expired" />);

    expect(screen.getByLabelText('Nombre de la tienda')).toHaveValue('');
    expect(screen.getByLabelText('Nombre de la tienda')).toHaveAttribute('placeholder', 'iManager Store');
  });

  it('blocks a store name longer than the backend allows', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const input = screen.getByLabelText('Nombre de la tienda');
    await user.click(input);
    await user.paste('a'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText('El nombre puede tener hasta 120 caracteres')).toBeInTheDocument();
    expect(mockAppContext.completeOnboarding).not.toHaveBeenCalled();
  });

  it('shows the spanish api message and hides raw zod json', async () => {
    const user = userEvent.setup();
    mockAppContext.completeOnboarding.mockRejectedValueOnce(new Error(JSON.stringify({
      statusCode: 500,
      error: 'Internal Server Error',
      message: '[{"code":"too_small","path":["storeName"]}]',
    })));
    render(<Onboarding />);

    const input = screen.getByLabelText('Nombre de la tienda');
    await user.type(input, 'Sucursal Norte');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText('Ocurrió un error en el servidor. Probá de nuevo en unos minutos.')).toBeInTheDocument();
    expect(screen.queryByText(/too_small/)).not.toBeInTheDocument();
  });

  it('creates a store from the onboarding form', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const input = screen.getByLabelText('Nombre de la tienda');
    await user.type(input, 'Sucursal Norte');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    await waitFor(() => {
      expect(mockAppContext.completeOnboarding).toHaveBeenCalledWith({
        storeName: 'Sucursal Norte',
        currency: 'USD',
        exchangeMode: 'auto',
        exchangeSource: 'blue',
        manualBuy: null,
        manualSell: null,
      });
    });
  });

  it('blocks a manual buy rate above the sell rate', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    await user.type(screen.getByLabelText('Nombre de la tienda'), 'Sucursal Norte');
    await user.click(screen.getByText('Moneda y dólar'));
    await user.selectOptions(screen.getByTestId('onboarding-exchange-mode'), 'manual');
    await user.type(screen.getByTestId('onboarding-manual-buy'), '1400');
    await user.type(screen.getByTestId('onboarding-manual-sell'), '1300');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText(MANUAL_QUOTE_ORDER_ERROR)).toBeInTheDocument();
    expect(screen.getByLabelText('Venta')).toHaveFocus();
    expect(screen.getByLabelText('Venta')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Venta')).toHaveAccessibleDescription(MANUAL_QUOTE_ORDER_ERROR);
    expect(scroll).toHaveBeenCalled();
    expect(mockAppContext.completeOnboarding).not.toHaveBeenCalled();

    await user.click(screen.getByText('Moneda y dólar'));
    expect(screen.getByText('Moneda y dólar').closest('details')).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(screen.getByText('Moneda y dólar').closest('details')).toHaveAttribute('open');
    expect(screen.getByLabelText('Venta')).toHaveFocus();

    await user.clear(screen.getByLabelText('Venta'));
    await user.type(screen.getByLabelText('Venta'), '1500');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Venta')).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    await waitFor(() => expect(mockAppContext.completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({ manualBuy: 1400, manualSell: 1500 })));
  });

  it.each(['Compra', 'Venta'])('focuses the missing manual quote: %s', async (missing) => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.type(screen.getByLabelText('Nombre de la tienda'), 'Sucursal Norte');
    await user.click(screen.getByText('Moneda y dólar'));
    await user.selectOptions(screen.getByTestId('onboarding-exchange-mode'), 'manual');
    await user.type(screen.getByLabelText(missing === 'Compra' ? 'Venta' : 'Compra'), '1400');
    await user.click(screen.getByText('Moneda y dólar'));
    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(screen.getByLabelText(missing)).toHaveFocus();
    expect(screen.getByLabelText(missing)).toHaveAccessibleDescription('Completá compra y venta, o dejalas vacías.');
    expect(mockAppContext.completeOnboarding).not.toHaveBeenCalled();
  });

  it('keeps currency settings folded and asks only for the store name', () => {
    render(<Onboarding />);
    expect(screen.getByText('Paso 1 de 2')).toBeVisible();
    expect(screen.getByLabelText('Paso 1 de 2').querySelectorAll('i')).toHaveLength(2);
    expect(screen.getByText('Lo ven tus clientes en el catálogo.')).toBeVisible();
    expect(screen.getByText('Lo cambiás cuando quieras.')).toBeVisible();
    expect(screen.getByText('USD · dólar blue $ 1.555')).toBeVisible();
    expect(screen.queryByLabelText(/Instagram/)).toBeNull();
    expect(screen.getByText('Moneda y dólar').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByTestId('onboarding-currency')).toHaveValue('USD');
  });

  it('accepts a valid invitation and notifies the caller', async () => {
    const user = userEvent.setup();
    const onInviteAccepted = vi.fn();
    mockInvitationState.preview = { storeName: 'Casa Central', role: 'OWNER' };

    render(<Onboarding inviteToken="invite-1" onInviteAccepted={onInviteAccepted} />);

    await user.click(screen.getByRole('button', { name: /Unirme a Casa Central/i }));

    await waitFor(() => {
      expect(mockAppContext.acceptStoreInvitation).toHaveBeenCalledWith('invite-1');
      expect(onInviteAccepted).toHaveBeenCalledTimes(1);
    });
  });

  it('lets the user retry invitation verification on recoverable errors', async () => {
    const user = userEvent.setup();
    mockInvitationState.error = 'El backend tardó en responder';

    render(<Onboarding inviteToken="invite-2" />);

    expect(screen.getByText('El backend tardó en responder')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));

    expect(mockInvitationState.reload).toHaveBeenCalledTimes(1);
  });
});
