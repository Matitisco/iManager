import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const redirectToMercadoPago = vi.hoisted(() => vi.fn());
vi.mock('../../services/mercadopago-url', () => ({ redirectToMercadoPago }));
const go = vi.fn();
function ui(children = <BillingScreen />) {
  return render(<DeskProvider value={{ tab: 'billing', go, open: vi.fn(), close: vi.fn(), openRecord: vi.fn(), toast: vi.fn(), isStaff: false }}>{children}</DeskProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/#/plan');
  Object.assign(state.billingDetails, state.summary);
  Object.assign(state.appSession, { membership: { role: 'OWNER' }, billing: state.summary });
  state.loadBilling.mockResolvedValue(state.billingDetails);
  state.cancelSubscription.mockResolvedValue({ ok: true });
  state.reloadSession.mockResolvedValue(undefined);
  state.quoteSubscription.mockResolvedValue({ id: 'q', key: 'BASIC_MONTHLY', usd: 22, amountArs: 22000, exchangeRate: 1000, payerEmail: 'owner@example.com', expiresAt: '2099-01-01' });
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
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar en Mercado Pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cambió el importe');
    expect(screen.queryByTestId('billing-quote')).not.toBeInTheDocument();
    expect(redirectToMercadoPago).not.toHaveBeenCalled();
  });
  it('confirma el importe y redirige al checkout de Mercado Pago', async () => {
    state.openSubscriptionCheckout.mockResolvedValue({ initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc' });
    window.history.replaceState(null, '', '/#/plan?preapproval_id=forged&status=authorized');
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    expect(await screen.findByText(/El pago se completa en Mercado Pago/)).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Número de tarjeta' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar en Mercado Pago' }));
    expect(state.openSubscriptionCheckout).toHaveBeenCalledWith('q');
    expect(redirectToMercadoPago).toHaveBeenCalledWith('https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc');
    expect(JSON.stringify(state.openSubscriptionCheckout.mock.calls)).not.toContain('forged');
  });
  it('un init_point inválido no sale de iManager', async () => {
    state.openSubscriptionCheckout.mockResolvedValue({ initPoint: 'https://evil.example/checkout' });
    redirectToMercadoPago.mockImplementationOnce(() => { throw new Error('No pudimos abrir Mercado Pago.'); });
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar en Mercado Pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir Mercado Pago');
    expect(screen.queryByTestId('billing-quote')).not.toBeInTheDocument();
  });
  it('un doble click envía una sola suscripción', async () => {
    let complete!: (value: { initPoint: string }) => void;
    state.openSubscriptionCheckout.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const button = await screen.findByRole('button', { name: 'Continuar en Mercado Pago' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(state.openSubscriptionCheckout).toHaveBeenCalledTimes(1);
    complete({ initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc' });
    await waitFor(() => expect(redirectToMercadoPago).toHaveBeenCalledTimes(1));
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
    expect(screen.getByText('Acceso ilimitado')).toBeVisible();
    expect(screen.getByText('Tu cuenta tiene acceso ilimitado, sin cobros ni límite de usuarios.')).toBeVisible();
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
  it('al volver de Mercado Pago confirma el plan y borra los parámetros', async () => {
    window.history.replaceState(null, '', '/#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1');
    state.loadBilling
      .mockResolvedValueOnce({ ...state.billingDetails, pendingCheckout: true, recentlyActivated: false })
      .mockResolvedValue({ ...state.billingDetails, plan: 'BASIC', status: 'ACTIVE', canCancel: true, pendingCheckout: false, recentlyActivated: true });
    vi.useFakeTimers();
    try {
      ui();
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTestId('billing-return-confirming')).toHaveTextContent('Confirmando tu pago…');
      expect(state.loadBilling).toHaveBeenCalledWith(true);
      expect(JSON.stringify(state.loadBilling.mock.calls)).not.toContain('pre-1');
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(screen.getByText('Listo. Tu plan Básico ya está activo.')).toBeVisible();
      expect(window.location.hash).toBe('#/plan');
      expect(window.location.href).not.toContain('pre-1');
      expect(window.location.href).not.toContain('authorized');
      expect(state.reloadSession).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('si el pago sigue pendiente ofrece reintentar y no muestra un error', async () => {
    window.history.replaceState(null, '', '/#/plan?preapproval_id=pre-1&status=pending');
    state.loadBilling.mockResolvedValue({ ...state.billingDetails, pendingCheckout: true, recentlyActivated: false });
    vi.useFakeTimers();
    try {
      ui();
      await act(async () => { await Promise.resolve(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(screen.getByTestId('billing-return-pending')).toHaveTextContent('Tu pago todavía está pendiente');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(window.location.hash).toBe('#/plan');
      expect(window.location.href).not.toContain('pre-1');
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTestId('billing-return-confirming')).toBeVisible();
    } finally { vi.useRealTimers(); }
  });
  it('un retorno de otra tienda abre el plan sin error ni mensaje de pago', async () => {
    window.history.replaceState(null, '', '/#/plan?preapproval_id=ajeno&status=authorized&external_reference=otra');
    state.loadBilling.mockResolvedValue({ ...state.billingDetails, pendingCheckout: false, recentlyActivated: false });
    ui();
    expect(await screen.findByRole('button', { name: 'Suscribirme a Básico' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-return-pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirmando tu pago…')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/plan');
    expect(window.location.href).not.toContain('ajeno');
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
