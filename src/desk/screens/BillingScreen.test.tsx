import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingSummary } from '../../types/billing';
import { BillingAccessBanner, BillingScreen } from './BillingScreen';
import { DeskProvider } from '../ui';

const state = vi.hoisted(() => {
  const summary: BillingSummary = { plan: 'TRIAL', status: 'TRIAL', period: null, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null, trialDaysLeft: 7, readOnly: false, memberLimit: 5, members: 1, overLimit: false, canCancel: false };
  return {
    summary, appSession: { user: { email: 'owner@example.com' }, store: { id: 's' }, membership: { role: 'OWNER' }, billing: summary },
    billingDetails: { ...summary, plans: [
      { key: 'BASIC_MONTHLY', name: 'Básico', plan: 'BASIC', period: 'MONTHLY', usd: 22, months: 1, users: 3 },
      { key: 'BUSINESS_MONTHLY', name: 'Negocio', plan: 'BUSINESS', period: 'MONTHLY', usd: 87, months: 1, users: 5 },
      { key: 'BASIC_ANNUAL', name: 'Básico', plan: 'BASIC', period: 'ANNUAL', usd: 198, months: 12, users: 3 },
      { key: 'BUSINESS_ANNUAL', name: 'Negocio', plan: 'BUSINESS', period: 'ANNUAL', usd: 783, months: 12, users: 5 },
    ] },
    loadBilling: vi.fn(), quoteSubscription: vi.fn(), openSubscriptionCheckout: vi.fn(), cancelSubscription: vi.fn(), reloadSession: vi.fn(),
  };
});
vi.mock('../../context/AppContext', () => ({ useAppContext: () => state }));
const token = vi.hoisted(() => ({ create: vi.fn(), unmount: vi.fn(), load: vi.fn() }));
vi.mock('../../services/mercadopago-fields', () => ({ loadMercadoPago: async () => { await token.load(); return class {
  fields = {
    create: () => {
      const callbacks: Record<string, () => void> = {};
      return { on: (event: string, callback: () => void) => { callbacks[event] = callback; }, mount: () => { callbacks.ready?.(); }, unmount: token.unmount, update: vi.fn() };
    },
    createCardToken: token.create,
  };
  getIdentificationTypes = async () => [{ id: 'DNI', name: 'DNI' }];
}; } }));
const go = vi.fn();
async function pay() {
  await userEvent.type(await screen.findByRole('textbox', { name: 'Nombre del titular' }), 'APRO');
  await userEvent.type(screen.getByRole('textbox', { name: 'Documento del titular' }), '12345678');
  const button = screen.getByRole('button', { name: 'Confirmar suscripción con tarjeta' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}
function ui(children = <BillingScreen />) {
  return render(<DeskProvider value={{ tab: 'billing', go, open: vi.fn(), close: vi.fn(), openRecord: vi.fn(), toast: vi.fn(), isStaff: false }}>{children}</DeskProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  token.create.mockResolvedValue({ id: 'single-use-token' });
  Object.assign(state.billingDetails, state.summary);
  Object.assign(state.appSession, { membership: { role: 'OWNER' }, billing: state.summary });
  state.loadBilling.mockResolvedValue(state.billingDetails);
  state.cancelSubscription.mockResolvedValue({ ok: true });
  state.reloadSession.mockResolvedValue(undefined);
  state.quoteSubscription.mockResolvedValue({ publicKey: 'public-key-placeholder', id: 'q', key: 'BASIC_MONTHLY', usd: 22, amountArs: 22000, exchangeRate: 1000, payerEmail: 'owner@example.com', expiresAt: '2099-01-01' });
});
describe('Plan y facturación', () => {
  it('muestra precios mensuales/anuales en USD y Sistema propio sin checkout', async () => {
    ui(); await screen.findByRole('button', { name: 'Suscribirme a Básico' });
    expect(screen.getByText('1 de 5 usuarios · Incluye al propietario')).toBeVisible();
    expect(screen.getByText('Hasta 3 usuarios')).toBeVisible(); expect(screen.getByText('Hasta 5 usuarios')).toBeVisible();
    expect(screen.getByText('US$ 22')).toBeVisible(); expect(screen.getByText('US$ 87')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Anual/ }));
    expect(screen.getByText('US$ 16,50')).toBeVisible(); expect(screen.getByText('US$ 65,25')).toBeVisible();
    expect(screen.getByText('US$ 198 por año, en un solo cobro')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Suscribirme/ })).toHaveLength(2);
  });
  it('muestra importe ARS y email antes de pedir el checkout', async () => {
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const quote = await screen.findByTestId('billing-quote');
    expect(quote).toHaveTextContent('22.000'); expect(quote).toHaveTextContent('owner@example.com');
    expect(state.openSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it('un error de checkout conserva mensaje visible y pide revisar el importe', async () => {
    state.openSubscriptionCheckout.mockRejectedValue(new Error('Cambió el importe en pesos.'));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await pay();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cambió el importe');
    expect(screen.queryByTestId('billing-quote')).not.toBeInTheDocument();
  });
  it('tokeniza antes de enviar y conserva iManager al confirmar la suscripción', async () => {
    state.openSubscriptionCheckout.mockResolvedValue({ status: 'authorized' });
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    expect(await screen.findByText('No necesitás una cuenta de Mercado Pago.')).toBeVisible();
    await pay();
    expect(token.create).toHaveBeenCalledWith({ cardholderName: 'APRO', identificationType: 'DNI', identificationNumber: '12345678' });
    expect(state.openSubscriptionCheckout).toHaveBeenCalledWith('q', 'single-use-token');
    expect(await screen.findByText(/Suscripción enviada/)).toBeVisible();
    expect(screen.queryByTestId('billing-quote')).not.toBeInTheDocument();
    expect(token.unmount).toHaveBeenCalledTimes(3);
  });
  it('una tarjeta inválida conserva el formulario y no crea suscripción', async () => {
    token.create.mockRejectedValue(new Error('provider detail'));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await pay();
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisá el número');
    expect(state.openSubscriptionCheckout).not.toHaveBeenCalled();
    expect(screen.getByTestId('billing-quote')).toBeVisible();
  });
  it('un doble submit durante la tokenización envía una sola suscripción', async () => {
    let complete!: (value: { id: string }) => void;
    token.create.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    state.openSubscriptionCheckout.mockResolvedValue({ status: 'authorized' });
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await pay();
    fireEvent.submit(screen.getByRole('form', { name: 'Pago con tarjeta' }));
    expect(token.create).toHaveBeenCalledTimes(1);
    expect(state.openSubscriptionCheckout).not.toHaveBeenCalled();
    complete({ id: 'single-use-token' });
    await screen.findByText(/Suscripción enviada/);
    expect(state.openSubscriptionCheckout).toHaveBeenCalledTimes(1);
  });
  it('permite recuperar un fallo del SDK sin abandonar iManager', async () => {
    token.load.mockRejectedValueOnce(new Error('SDK unavailable'));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los campos');
    expect(screen.getByRole('button', { name: 'Confirmar suscripción con tarjeta' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar formulario' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar suscripción con tarjeta' })).toBeEnabled());
    expect(state.openSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it('cambiar email o frecuencia invalida la cotización anterior', async () => {
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await screen.findByTestId('billing-quote');
    await userEvent.type(screen.getByRole('textbox', { name: /Email del pagador/ }), 'x');
    expect(screen.queryByTestId('billing-quote')).not.toBeInTheDocument();
  });
  it('el plan interno nunca muestra checkout ni cancelación', async () => {
    Object.assign(state.billingDetails, { plan: 'INTERNAL', memberLimit: null });
    ui(); await waitFor(() => expect(screen.queryByText('Cargando planes…')).not.toBeInTheDocument());
    expect(screen.getByText(/sin cobros ni límite/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Suscribirme|Cancelar suscripción/ })).not.toBeInTheDocument();
  });
  it('cancelar requiere confirmación y conserva el error si MP falla', async () => {
    Object.assign(state.billingDetails, { plan: 'BASIC', status: 'ACTIVE', canCancel: true, paidThrough: '2099-01-01T00:00:00Z' });
    state.cancelSubscription.mockRejectedValue(new Error('No se pudo cancelar.'));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Cancelar suscripción' }));
    expect(state.cancelSubscription).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar suscripción' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cancelar.');
    expect(screen.getByRole('button', { name: 'Sí, cancelar suscripción' })).toBeVisible();
  });
  it('prohíbe checkout si el equipo excede Básico', async () => {
    Object.assign(state.billingDetails, { members: 4 }); ui();
    expect(await screen.findByRole('button', { name: 'Suscribirme a Básico' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suscribirme a Negocio' })).toBeEnabled();
  });
  it('staff recibe mensaje y no obtiene acciones de facturación', () => {
    state.appSession.membership.role = 'STAFF'; ui();
    expect(screen.getByText(/Solo el propietario/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Suscribirme/ })).not.toBeInTheDocument();
  });
  it('contador de prueba navega al plan; empleados vencidos contactan al propietario', async () => {
    const view = ui(<BillingAccessBanner dashboard />);
    expect(screen.getByTestId('billing-access-banner')).toHaveTextContent('7 días restantes');
    await userEvent.click(screen.getByRole('button', { name: 'Ver planes' })); expect(go).toHaveBeenCalledWith('billing');
    state.appSession.membership.role = 'STAFF'; state.appSession.billing = { ...state.summary, readOnly: true, trialDaysLeft: 0 };
    view.rerender(<DeskProvider value={{ tab: 'billing', go, open: vi.fn(), close: vi.fn(), openRecord: vi.fn(), toast: vi.fn(), isStaff: true }}><BillingAccessBanner /></DeskProvider>);
    expect(screen.getByTestId('billing-access-banner')).toHaveTextContent('Contactá al propietario');
    expect(screen.queryByRole('button', { name: 'Ver planes' })).not.toBeInTheDocument();
  });
});
