import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeriodicSummary as Summary } from '../../services/periodic-summary-api';
import { PeriodicSummary } from './PeriodicSummary';
import { ReportsScreen } from './ReportsScreen';
import { ExchangeProvider } from '../exchange';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), go: vi.fn(), back: vi.fn(), phone: false }));
const context = vi.hoisted(() => ({
  user: { uid: 'owner', getIdToken: async () => 'test' }, backendStatus: 'ready', sessionConfirmed: true,
  appSession: { user: { id: 'owner' }, store: { id: 'store' }, membership: { role: 'OWNER', sections: null as string[] | null }, onboardingRequired: false },
  sales: [], inventory: [], clients: [], tradeIns: [], returns: [],
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/periodic-summary-api', () => ({ fetchPeriodicSummary: mocks.fetch }));
vi.mock('../section-notices', () => ({ usePhoneLayout: () => mocks.phone }));
vi.mock('../ui', async importOriginal => ({ ...await importOriginal<typeof import('../ui')>(), useDesk: () => ({ go: mocks.go, back: mocks.back }) }));

function fixture(empty = false): Summary {
  const period = { id: 'month:2026-09', kind: 'month' as const, from: '2026-09-01', to: '2026-09-30', label: 'septiembre de 2026' };
  return {
    period, periods: { months: [period], halves: [{ id: 'half:2026-09-16', kind: 'half', from: '2026-09-16', to: '2026-09-30', label: '16 al 30/09/2026' }] },
    sales: { total: empty ? [] : [{ amount: 500, currency: 'ARS' }], items: empty ? [] : Array.from({ length: 5 }, (_, index) => ({ id: `s${index}`, day: '2026-09-28', title: `iPhone ${index}`, detail: 'Nicolás Pereyra', amount: index === 1 ? 9000 : 125, currency: 'ARS', voided: index === 1 })) },
    returns: { total: empty ? [] : [{ amount: 280, currency: 'ARS' }], items: empty ? [] : [
      { id: 'r1', day: '2026-09-19', title: 'AirPods · reintegro', detail: 'Roberto Carlos', amount: 280, currency: 'ARS', pending: false, status: 'RESUELTO' },
      { id: 'r2', day: '2026-09-05', title: 'iPhone 12 · RMA', detail: 'IMEI 353912087741265', amount: 0, currency: 'ARS', pending: true, status: 'ENVIADO' },
    ] },
    stock: { count: empty ? 0 : 1, counts: empty ? 0 : 1, latestDay: empty ? null : '2026-09-28', items: empty ? [] : [{ id: 'x1', day: '2026-09-28', title: 'iPhone 13 128GB', imei: '352094113377802', status: 'Falta' }] },
  };
}
function show() { return render(<PeriodicSummary navigation={<div>Resumen periódico</div>} />); }
async function loaded() { await screen.findByRole('region', { name: 'Ventas' }); }

beforeEach(() => {
  mocks.phone = false; mocks.go.mockReset(); mocks.back.mockReset(); mocks.fetch.mockReset(); mocks.fetch.mockResolvedValue(fixture());
  context.backendStatus = 'ready'; context.sessionConfirmed = true;
  context.appSession.store.id = 'store'; context.appSession.membership.sections = null;
});
afterEach(() => vi.restoreAllMocks());

describe('Resumen periódico', () => {
  it('is available as an in-app Reportes tab and keeps the existing reports', async () => {
    render(<ReportsScreen />);
    expect(screen.getByRole('button', { name: 'Personalizado' })).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Resumen periódico' }));
    await loaded();
    expect(screen.getByRole('tab', { name: 'Resumen periódico' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Personalizado' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
    expect(screen.getByRole('button', { name: 'Personalizado' })).toBeVisible();
  });
  it('renders audit rows and source totals, previews three sales, and opens the entire list in a shared Sheet', async () => {
    show(); await loaded();
    const sales = screen.getByRole('region', { name: 'Ventas' });
    expect(within(sales).getByText('$ 500')).toBeVisible();
    expect(sales.querySelector('s')).toHaveTextContent('$ 9.000');
    expect(within(sales).queryByText(/Anulada, no suma/)).not.toBeInTheDocument();
    expect(sales.querySelector('.periodic-void small')).toHaveTextContent(/^28\/09\/2026$/);
    expect(within(sales).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('En curso')).toBeVisible();
    expect(screen.getByText('1 equipo')).toBeVisible();
    expect(screen.getByText('IMEI 352094113377802')).toBeVisible();
    await userEvent.click(within(sales).getByRole('button', { name: 'Ver todas las ventas (5)' }));
    const dialog = screen.getByRole('dialog', { name: 'Ventas' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
    expect(within(dialog).getByText('iPhone 4')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver todas las ventas (5)' })).toHaveFocus();
  });
  it.each([false, true])('shows the approved empty cards on phone=%s', async phone => {
    mocks.phone = phone; mocks.fetch.mockResolvedValue(fixture(true));
    show(); await loaded();
    expect(screen.getAllByText('$ 0')).toHaveLength(2);
    expect(screen.getByText('0 equipos')).toBeVisible();
    for (const card of screen.getAllByRole('region')) {
      expect(card.children).toHaveLength(2);
      expect(card.querySelector('p, ul')).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/01\/09\/2026 – 30\/09\/2026/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver todas/ })).not.toBeInTheDocument();
  });
  it('keeps an empty stock card concise even when a physical count matched', async () => {
    const data = fixture(true); data.stock!.counts = 1; data.stock!.latestDay = '2026-09-28'; mocks.fetch.mockResolvedValue(data);
    show(); await loaded();
    expect(screen.getByText('0 equipos')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Diferencias de stock' }).querySelector('p')).not.toBeInTheDocument();
    expect(screen.queryByText('No hubo conteo físico en el período')).not.toBeInTheDocument();
  });
  it('switches latest and historical calendar periods with the shared selector', async () => {
    show(); await loaded();
    expect(mocks.fetch).toHaveBeenLastCalledWith(context.user, 'latest-half', expect.any(AbortSignal));
    await userEvent.click(screen.getByRole('button', { name: 'Último mes' }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith(context.user, 'latest-month', expect.any(AbortSignal)));
    await loaded();
    await userEvent.click(screen.getByRole('combobox', { name: 'Períodos anteriores' }));
    await userEvent.click(screen.getByRole('option', { name: '16 al 30/09/2026' }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith(context.user, 'half:2026-09-16', expect.any(AbortSignal)));
    expect(screen.getByRole('combobox', { name: 'Períodos anteriores' })).toHaveTextContent('16 al 30/09/2026');
    expect(screen.queryByText(/01\/09\/2026 – 30\/09\/2026/)).not.toBeInTheDocument();
  });
  it('replaces a failed load with a neutral empty state and logs its cause', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cause = new Error('No se pudo cargar el resumen periódico');
    let reject!: (reason: Error) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    show();
    expect(screen.getByTestId('periodic-summary-loading')).toBeInTheDocument();
    expect(screen.queryByText('$ 0')).not.toBeInTheDocument();
    reject(cause);
    expect(await screen.findByText('Sin resumen para mostrar.')).toBeVisible();
    expect(warn).toHaveBeenCalledWith('No se pudo cargar el resumen periódico.', cause);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
    expect(screen.queryByTestId('periodic-summary-loading')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Último mes' }));
    await loaded();
  });
  it('discards late responses after switching periods', async () => {
    let resolve!: (data: Summary) => void;
    mocks.fetch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Último mes' }));
    await loaded();
    const obsolete = fixture(); obsolete.sales!.total[0].amount = 99999;
    resolve(obsolete);
    await waitFor(() => expect(screen.getByText('$ 500')).toBeVisible());
    expect(screen.queryByText('$ 99.999')).not.toBeInTheDocument();
  });
  it('clears data immediately on tenant/permission changes and aborts the previous request', async () => {
    const view = show(); await loaded();
    const signal = mocks.fetch.mock.calls[0][2] as AbortSignal;
    mocks.fetch.mockReturnValue(new Promise(() => {}));
    context.appSession.store.id = 'other-store'; view.rerender(<PeriodicSummary navigation={null} />);
    expect(screen.queryByText('$ 500')).not.toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    expect(screen.getByTestId('periodic-summary-loading')).toBeInTheDocument();
  });
  it('does not query before the business session is ready', () => {
    context.sessionConfirmed = false; show();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('$ 0')).not.toBeInTheDocument();
  });
  it('hides forbidden cards and does not describe missing permissions as zero movements', async () => {
    const data = fixture(); data.stock = null; mocks.fetch.mockResolvedValue(data);
    show(); await loaded();
    expect(screen.queryByRole('region', { name: 'Diferencias de stock' })).not.toBeInTheDocument();
  });
  it('converts amounts with the shared exchange provider and preserves totals when toggling currency', async () => {
    const data = fixture(); data.sales!.total = [{ amount: 10, currency: 'USD' }, { amount: 1000, currency: 'ARS' }]; mocks.fetch.mockResolvedValue(data);
    const settings = { currency: 'ARS' as const, exchangeMode: 'manual' as const, exchangeSource: 'blue' as const, manualBuy: 1000, manualSell: 1000 };
    const view = render(<ExchangeProvider settings={settings}><PeriodicSummary navigation={null} /></ExchangeProvider>); await loaded();
    expect(within(screen.getByRole('region', { name: 'Ventas' })).getByText('$ 11.000')).toBeVisible();
    view.rerender(<ExchangeProvider settings={{ ...settings, currency: 'USD' }}><PeriodicSummary navigation={null} /></ExchangeProvider>);
    expect(within(screen.getByRole('region', { name: 'Ventas' })).getByText('US$ 11')).toBeVisible();
  });
  it('shows an unavailable total rather than adding incompatible currencies without a rate', async () => {
    const data = fixture(); data.sales!.total = [{ amount: 10, currency: 'USD' }]; mocks.fetch.mockResolvedValue(data);
    render(<ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: null, manualSell: null }}><PeriodicSummary navigation={null} /></ExchangeProvider>); await loaded();
    expect(within(screen.getByRole('region', { name: 'Ventas' })).getByText('—')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('No hay una cotización válida');
  });
  it.each([false, true])('opens every complete breakdown as a shared modal without navigation on phone=%s', async phone => {
    mocks.phone = phone;
    const data = fixture();
    data.returns!.items.push(...Array.from({ length: 3 }, (_, index) => ({ ...data.returns!.items[0], id: `extra-r${index}`, title: `Reintegro ${index}` })));
    data.stock!.items.push(...Array.from({ length: 3 }, (_, index) => ({ ...data.stock!.items[0], id: `extra-x${index}`, imei: `35209411337781${index}` })));
    data.stock!.count = data.stock!.items.length;
    mocks.fetch.mockResolvedValue(data);
    show(); await loaded();
    for (const [title, count] of [['Ventas', 5], ['Devoluciones y RMA', 5], ['Diferencias de stock', 4]] as const) {
      const card = screen.getByRole('region', { name: title });
      expect(within(card).getAllByRole('listitem')).toHaveLength(3);
      const trigger = within(card).getByRole('button');
      expect(trigger).toHaveTextContent(`Ver todas (${count})`);
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      await userEvent.click(trigger);
      const dialog = screen.getByRole('dialog', { name: title });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveClass('sheet', 'sheet-frame', 'periodic-breakdown');
      expect(within(dialog).getAllByRole('listitem')).toHaveLength(count);
      if (title === 'Diferencias de stock') expect(within(dialog).getByText('IMEI 352094113377802 · 28/09/2026')).toBeVisible();
      if (title === 'Ventas') {
        expect(within(dialog).getByText('iPhone 4')).toBeVisible();
        expect(dialog.querySelector('s')).toHaveTextContent('$ 9.000');
        expect(dialog).not.toHaveTextContent('Anulada, no suma');
      }
      await userEvent.tab();
      const close = within(dialog).getByRole('button', { name: 'Cerrar' });
      expect(close).toHaveFocus();
      await userEvent.tab();
      expect(close).toHaveFocus();
      await userEvent.click(close);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
    }
    expect(mocks.go).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
  });
  it('dismisses the modal on backdrop click and removes it when the tenant or period changes', async () => {
    const view = show(); await loaded();
    const open = () => userEvent.click(screen.getByRole('button', { name: 'Ver todas las ventas (5)' }));
    await open();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Último mes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await loaded(); await open();
    context.appSession.store.id = 'other-store';
    view.rerender(<PeriodicSummary navigation={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await loaded();
  });
});

 it('renders no replacement empty state when the summary fails offline', async () => {
  const cause = new TypeError('Failed to fetch');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  mocks.fetch.mockRejectedValueOnce(cause);
  show();
  await waitFor(() => expect(screen.queryByTestId('periodic-summary-loading')).not.toBeInTheDocument());
  expect(warn).toHaveBeenCalledWith('No se pudo cargar el resumen periódico.', cause);
  expect(screen.queryByText('Sin resumen para mostrar.')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
