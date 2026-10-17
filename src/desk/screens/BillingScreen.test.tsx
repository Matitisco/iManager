import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingSummary } from '../../types/billing';
import { BILLING_RETURN_CONFIRMING_MS } from '../billing-return';
import { BillingAccessBanner, BillingScreen } from './BillingScreen';
import { DeskProvider } from '../ui';

const state = vi.hoisted(() => {
  const summary: BillingSummary = { plan: 'TRIAL', status: 'TRIAL', period: null, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null, trialDaysLeft: 7, readOnly: false, memberLimit: 3, members: 1, overLimit: false, canCancel: false };
  return {
    summary, appSession: { user: { email: 'owner@example.com' }, store: { id: 's' }, membership: { role: 'OWNER' }, billing: summary },
    billingDetails: { ...summary,     plans: [
      { key: 'BASIC_MONTHLY', name: 'Básico', plan: 'BASIC', period: 'MONTHLY', usd: 22, months: 1, users: 3, amountArs: 22000, exchangeRate: 1000 },
      { key: 'BUSINESS_MONTHLY', name: 'Negocio', plan: 'BUSINESS', period: 'MONTHLY', usd: 87, months: 1, users: 5, amountArs: 87000, exchangeRate: 1000 },
      { key: 'BASIC_ANNUAL', name: 'Básico', plan: 'BASIC', period: 'ANNUAL', usd: 198, months: 12, users: 3, amountArs: 198000, exchangeRate: 1000 },
      { key: 'BUSINESS_ANNUAL', name: 'Negocio', plan: 'BUSINESS', period: 'ANNUAL', usd: 783, months: 12, users: 5, amountArs: 783000, exchangeRate: 1000 },
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
  state.quoteSubscription.mockResolvedValue({ id: 'q', key: 'BASIC_MONTHLY', usd: 22, amountArs: 22000, exchangeRate: 1000, payerEmail: 'owner@example.com', expiresAt: '2099-01-01', firstChargeAt: '2099-01-01T00:00:00Z' });
});
describe('Plan y facturación', () => {
  it('muestra precios mensuales/anuales en USD y Sistema propio sin checkout', async () => {
    ui(); await screen.findByRole('button', { name: 'Suscribirme a Básico' });
    expect(screen.getByRole('heading', { name: 'Prueba gratuita · Plan Básico' })).toBeVisible();
    expect(screen.getByText(/Quedan 7 días/)).toBeVisible();
    expect(screen.getByText('1 de 3')).toBeVisible();
    expect(screen.getByText('Hasta 3 usuarios')).toBeVisible(); expect(screen.getByText('Hasta 5 usuarios')).toBeVisible();
    expect(screen.getAllByText(/US\$ 22/).length).toBeGreaterThan(0); expect(screen.getByText(/US\$ 87/)).toBeVisible();
    expect(screen.getAllByText(/22\.000/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Anual/ }));
    expect(screen.getByText(/US\$ 16,5\/mes/)).toBeVisible(); expect(screen.getByText(/US\$ 65,25\/mes/)).toBeVisible();
    expect(screen.getByText('US$ 198 por año')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Suscribirme/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Escribinos/ })).toBeVisible();
  });
  it('muestra importe ARS y email antes de pedir el checkout', async () => {
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const quote = await screen.findByRole('dialog', { name: 'Antes de suscribirte' });
    expect(quote).toHaveAttribute('aria-modal', 'true');
    expect(quote).toHaveTextContent('22.000'); expect(quote).toHaveTextContent('owner@example.com');
    expect(quote).toHaveTextContent('Primer cobro el');
    expect(quote).toHaveTextContent('dólar blue de hoy');
    expect(quote).toHaveTextContent('Débito automático en pesos');
    expect(state.openSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it('un email incompatible queda dentro del modal y no habla de la tarjeta', async () => {
    state.openSubscriptionCheckout.mockRejectedValue(new Error('Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.'));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar en Mercado Pago' }));
    const quote = await screen.findByTestId('billing-quote');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Este email no se puede usar con la cuenta de cobro actual');
    expect(alert).not.toHaveTextContent('tarjeta');
    expect(quote).toContainElement(alert);
    expect(redirectToMercadoPago).not.toHaveBeenCalled();
  });
  it('un error de checkout queda dentro del modal', async () => {
    state.openSubscriptionCheckout.mockRejectedValue(new Error('Cambió el importe en pesos.'));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar en Mercado Pago' }));
    const quote = await screen.findByTestId('billing-quote');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cambió el importe');
    expect(quote).toContainElement(alert);
    expect(screen.getByRole('button', { name: 'Continuar en Mercado Pago' })).toBeEnabled();
    expect(redirectToMercadoPago).not.toHaveBeenCalled();
  });
  it('confirma el importe y redirige al checkout de Mercado Pago', async () => {
    state.openSubscriptionCheckout.mockResolvedValue({ initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc' });
    window.history.replaceState(null, '', '/#/plan?preapproval_id=forged&status=authorized');
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const quote = await screen.findByRole('dialog', { name: 'Antes de suscribirte' });
    expect(quote).toHaveTextContent(/Débito automático en pesos/);
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
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos abrir Mercado Pago');
    expect(screen.getByTestId('billing-quote')).toContainElement(alert);
  });
  it('un doble click envía una sola suscripción', async () => {
    let complete!: (value: { initPoint: string }) => void;
    state.openSubscriptionCheckout.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    ui(); await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const button = await screen.findByRole('button', { name: 'Continuar en Mercado Pago' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(state.openSubscriptionCheckout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Abriendo Mercado Pago…' })).toHaveAttribute('aria-busy', 'true');
    complete({ initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc' });
    await waitFor(() => expect(redirectToMercadoPago).toHaveBeenCalledTimes(1));
  });
  it('contiene el foco y se cierra con escape, volver y el fondo', async () => {
    const view = ui();
    const open = screen.getByRole('button', { name: 'Suscribirme a Básico' });
    await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const dialog = await screen.findByRole('dialog', { name: 'Antes de suscribirte' });
    expect(dialog).toHaveAttribute('data-layout', 'dialog');
    expect(view.container.inert).toBe(true);
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'Cambiar' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'Continuar en Mercado Pago' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(within(dialog).getByRole('button', { name: 'Continuar en Mercado Pago' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(view.container.inert).toBe(false);
    expect(open).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme a Básico' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Antes de suscribirte' })).getByRole('button', { name: 'Volver' }));
    expect(screen.queryByTestId('billing-quote')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme a Básico' }));
    fireEvent.mouseDown(await screen.findByTestId('billing-modal-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('en el teléfono la confirmación es una hoja inferior', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      ui();
      await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
      const dialog = await screen.findByRole('dialog', { name: 'Antes de suscribirte' });
      expect(dialog).toHaveAttribute('data-layout', 'sheet');
      expect(dialog.querySelector('.billing-modal-grab')).toBeTruthy();
    } finally { window.matchMedia = original; }
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
    expect(screen.getByRole('radio', { name: /Básico/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /Negocio/ }));
    expect(screen.getByRole('button', { name: 'Suscribirme a Negocio' })).toBeEnabled();
  });
  it('muestra la prueba vencida y, con un plan pago, el próximo cobro y el historial', async () => {
    Object.assign(state.billingDetails, { status: 'EXPIRED', trialDaysLeft: 0, readOnly: true });
    const view = ui();
    expect(await screen.findByText('Vencida')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Elegí un plan para seguir' })).toBeVisible();
    expect(screen.getByText(/Tu prueba terminó el/)).toBeVisible();
    expect(screen.getByText(/Tus datos están guardados/)).toBeVisible();
    view.unmount();
    Object.assign(state.billingDetails, { plan: 'BASIC', status: 'ACTIVE', period: 'MONTHLY', canCancel: true, paidThrough: '2026-11-17T15:00:00Z', trialDaysLeft: 0, readOnly: false, members: 2 });
    ui();
    expect(await screen.findByText('Activa')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cambiar a Negocio' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Cobros' })).toHaveTextContent('Pagado');
    expect(screen.getByText(/dólar blue del día del cobro/)).toBeVisible();
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
    state.loadBilling.mockImplementation(async (_refresh?: boolean, replaceAbandoned?: boolean) => ({
      ...state.billingDetails, pendingCheckout: !replaceAbandoned, recentlyActivated: false,
    }));
    vi.useFakeTimers();
    try {
      ui();
      await act(async () => { await Promise.resolve(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(screen.getByTestId('billing-return-pending')).toHaveTextContent('Esperando a Mercado Pago');
      expect(screen.getByTestId('billing-return-pending')).toHaveTextContent('Plan Básico · mensual');
      expect(screen.getByTestId('billing-return-pending')).toHaveTextContent('Pago en proceso');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(window.location.hash).toBe('#/plan');
      expect(window.location.href).not.toContain('pre-1');
      expect(state.loadBilling.mock.calls.every(call => call[1] !== true)).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Ya pagué, actualizar' }));
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(state.loadBilling).toHaveBeenCalledWith(true, true);
      expect(screen.queryByTestId('billing-return-pending')).not.toBeInTheDocument();
      expect(screen.queryByTestId('billing-return-confirming')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Suscribirme a Básico' })).toBeVisible();
    } finally { vi.useRealTimers(); }
  });
  it('actualizar estado y reintentar un error reemplazan el checkout abandonado', async () => {
    const view = ui();
    await screen.findByRole('button', { name: 'Suscribirme a Básico' });
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado del pago' }));
    expect(state.loadBilling).toHaveBeenCalledWith(true, true);
    expect(await screen.findByText('Estado actualizado desde Mercado Pago.')).toBeVisible();
    view.unmount();
    state.loadBilling.mockRejectedValueOnce(new Error('Probá de nuevo.'));
    ui();
    expect(await screen.findByRole('alert')).toHaveTextContent('Probá de nuevo.');
    state.loadBilling.mockResolvedValue(state.billingDetails);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(state.loadBilling).toHaveBeenCalledWith(true, true);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
  it('un retorno de otra tienda abre el plan sin error ni mensaje de pago', async () => {
    window.history.replaceState(null, '', '/#/plan?preapproval_id=ajeno&status=authorized&external_reference=otra');
    state.loadBilling.mockResolvedValue({ ...state.billingDetails, pendingCheckout: false, recentlyActivated: false });
    ui();
    expect(screen.getByTestId('billing-return-confirming')).toHaveTextContent('Confirmando tu pago…');
    expect(await screen.findByRole('button', { name: 'Suscribirme a Básico' })).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Confirmando tu pago…')).not.toBeInTheDocument(), { timeout: BILLING_RETURN_CONFIRMING_MS + 1_000 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-return-pending')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/plan');
    expect(window.location.href).not.toContain('ajeno');
  });
  it('mantiene la confirmación si un refresh duplicado ya trae el plan activo', async () => {
    window.history.replaceState(null, '', '/#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1');
    let calls = 0;
    state.loadBilling.mockImplementation(async () => {
      calls += 1;
      const active = calls > 1;
      return { ...state.billingDetails, plan: active ? 'BASIC' : 'TRIAL', status: active ? 'ACTIVE' : 'TRIAL', canCancel: active, pendingCheckout: !active, recentlyActivated: active, paidThrough: active ? '2099-01-01T00:00:00Z' : null };
    });
    vi.useFakeTimers();
    try {
      render(<StrictMode><DeskProvider value={{ tab: 'billing', go, open: vi.fn(), close: vi.fn(), openRecord: vi.fn(), toast: vi.fn(), isStaff: false }}><BillingScreen /></DeskProvider></StrictMode>);
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTestId('billing-return-confirming')).toHaveTextContent('Confirmando tu pago…');
      expect(calls).toBe(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(screen.getByText('Listo. Tu plan Básico ya está activo.')).toBeVisible();
      expect(calls).toBe(2);
    } finally { vi.useRealTimers(); }
  });
  it('no cierra la confirmación si el primer refresh ya trae el plan activo', async () => {
    window.history.replaceState(null, '', '/#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1');
    state.loadBilling.mockResolvedValue({ ...state.billingDetails, plan: 'BASIC', status: 'ACTIVE', canCancel: true, pendingCheckout: false, recentlyActivated: true, paidThrough: '2099-01-01T00:00:00Z' });
    vi.useFakeTimers();
    try {
      ui();
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTestId('billing-return-confirming')).toHaveTextContent('Confirmando tu pago…');
      expect(screen.queryByText('Listo. Tu plan Básico ya está activo.')).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(BILLING_RETURN_CONFIRMING_MS - 1); });
      expect(screen.getByTestId('billing-return-confirming')).toBeVisible();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.getByText('Listo. Tu plan Básico ya está activo.')).toBeVisible();
      expect(window.location.hash).toBe('#/plan');
    } finally { vi.useRealTimers(); }
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
  it('el recordatorio del primer cobro aparece en el dashboard', () => {
    state.appSession.billing = { ...state.summary, chargeReminder: true, firstChargeAt: '2099-01-03T00:00:00.000Z' };
    ui(<BillingAccessBanner dashboard />);
    expect(screen.getByTestId('billing-charge-reminder')).toHaveTextContent('Primer cobro el');
    expect(screen.getByTestId('billing-charge-reminder')).toHaveTextContent('No se cobra antes');
  });
});
