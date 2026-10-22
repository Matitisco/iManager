import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commissionFixturePeople } from '../../test/commission-fixtures';
import { ReportsScreen } from './ReportsScreen';
const ctx = vi.hoisted(() => ({ sales: [], inventory: [], tradeIns: [], clients: [], user: { uid: 'owner', getIdToken: vi.fn() }, appSession: { user: { id: 'owner' }, store: { id: 'store' }, membership: { role: 'OWNER', sections: null as string[] | null } } }));
const fetchReport = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/commissions-api', () => ({ fetchCommissionReport: fetchReport }));
vi.mock('../csv', () => ({ downloadCsv: download }));
vi.mock('../ui', async () => ({ ...await vi.importActual<typeof import('../ui')>('../ui'), useDesk: () => ({ open: vi.fn(), toast: vi.fn() }) }));
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-21T15:00:00Z')); fetchReport.mockReset().mockResolvedValue({ from: '2026-10', to: '2026-10', rows: commissionFixturePeople.map(person => ({ ...person, period: '2026-10' })) }); download.mockClear(); ctx.appSession.membership = { role: 'OWNER', sections: null }; });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('loads monthly server projections and exports both original currencies through Reports', async () => {
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  expect(fetchReport).toHaveBeenCalledWith(ctx.user, '2026-10', '2026-10');
  expect(fetchReport).toHaveBeenCalledWith(ctx.user, '2026-09', '2026-09');
  expect(document.querySelector('.gamount')).toHaveTextContent('$ 646.000');
  expect(screen.getByText('Por mes')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  const [rows, filename] = download.mock.calls[0];
  expect(filename).toBe('reporte-comisiones.csv');
  expect(rows[0]).toEqual(expect.arrayContaining(['Comisión ARS', 'Comisión USD', 'Pendiente ARS', 'Pendiente USD']));
  expect(rows[1]).toEqual(expect.arrayContaining(['Sofía Pérez', '290000', '40']));
});
it('does not offer the team commission report without its permission', () => {
  ctx.appSession.membership = { role: 'MANAGER', sections: ['reports'] };
  render(<ReportsScreen />);
  expect(screen.queryByRole('button', { name: 'Comisiones' })).not.toBeInTheDocument();
  expect(fetchReport).not.toHaveBeenCalled();
});

it('exports cancelled earned zero, paid partial and negative carry, and pluralizes one sale', async () => {
  fetchReport.mockResolvedValue({ from: '2026-10', to: '2026-11', rows: [
    { ...commissionFixturePeople[1], period: '2026-10', salesCount: 1, earned: { ARS: 0, USD: 0 }, paid: { ARS: 0, USD: 10 }, pending: { ARS: 0, USD: -10 }, adjustmentsTotal: { ARS: 0, USD: 0 }, converted: { earned: { ARS: 0, USD: 0 }, paid: { ARS: 15500, USD: 10 }, pending: { ARS: -15500, USD: -10 } } },
    { ...commissionFixturePeople[1], period: '2026-11', salesCount: 0, earned: { ARS: 0, USD: 0 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: 0, USD: -10 }, adjustmentsTotal: { ARS: 0, USD: -10 }, converted: { earned: { ARS: -15500, USD: -10 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: -15500, USD: -10 } } },
  ] });
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  expect(screen.getByText('2026-10 · 1 venta')).toBeInTheDocument();
  expect(screen.queryByText(/1 ventas/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  expect(download.mock.calls[0][0].slice(1)).toEqual([
    ['2026-10', 'Martín Gómez', '1', '0', '0', '0', '10', '0', '-10', '0', '0'],
  ]);
});


it('keeps general periods across commission tabs and rolls January back to December', async () => {
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: '90 días' }));
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  expect(screen.queryByRole('group', { name: 'Período' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox', { name: 'Mes de comisiones' }));
  await userEvent.click(screen.getByRole('option', { name: 'Enero 2026' }));
  await waitFor(() => expect(fetchReport).toHaveBeenCalledWith(ctx.user, '2026-01', '2026-01'));
  expect(fetchReport).toHaveBeenCalledWith(ctx.user, '2025-12', '2025-12');
  await userEvent.click(screen.getByRole('button', { name: 'Ventas' }));
  expect(screen.getByRole('button', { name: '90 días' })).toHaveAttribute('aria-pressed', 'true');
});

it('filters commission CSV to precisely the visible category', async () => {
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Porción Sofía Pérez' }));
  expect(document.querySelectorAll('.gtk')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  expect(download.mock.calls[0][0]).toHaveLength(2);
  expect(download.mock.calls[0][0][1][1]).toBe('Sofía Pérez');
  expect(screen.getByText(/solo detalles y CSV/)).toBeInTheDocument();
});

it('presents negative generated adjustments as signed values without donut proportions', async () => {
  fetchReport.mockResolvedValue({ rows: [{ ...commissionFixturePeople[1], period: '2026-10', converted: { ...commissionFixturePeople[1].converted, earned: { ARS: -15500, USD: -10 } } }] });
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  expect(screen.getByText('Importes con signo · incluye ajustes')).toBeInTheDocument();
  expect(document.querySelector('.gdonut')).toBeNull();
  expect(document.querySelector('.report-signed')).toHaveTextContent('-15.500');
});

it('ignores responses from an obsolete month and permission scope', async () => {
  let resolveOld!: (value: unknown) => void;
  fetchReport.mockImplementation((_user, from) => from === '2026-10' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ rows: [] }));
  const view = render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Mes de comisiones' }));
  await userEvent.click(screen.getByRole('option', { name: 'Enero 2026' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  await act(async () => resolveOld({ rows: commissionFixturePeople.map(person => ({ ...person, period: '2026-10' })) }));
  expect(document.querySelector('.gamount')).toHaveTextContent('$ 0');
  expect(screen.queryByText('Sofía Pérez')).not.toBeInTheDocument();
  ctx.appSession.membership = { role: 'STAFF', sections: ['reports', 'clients'] };
  view.rerender(<ReportsScreen />);
  expect(screen.queryByRole('button', { name: 'Comisiones' })).not.toBeInTheDocument();
  expect(screen.queryByText('Sofía Pérez')).not.toBeInTheDocument();
});

it('keeps a valid current monthly report when the previous month fails', async () => {
  fetchReport.mockImplementation((_user, from) => from === '2026-09' ? Promise.reject(new Error('Unavailable previous')) : Promise.resolve({ rows: commissionFixturePeople.map(person => ({ ...person, period: '2026-10' })) }));
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  expect(document.querySelector('.gamount')).toHaveTextContent('$ 646.000');
  expect(document.querySelector('.gdelta')).toHaveTextContent('Variación no disponible');
});
