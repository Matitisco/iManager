import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
beforeEach(() => { fetchReport.mockReset().mockResolvedValue({ from: '2026-10', to: '2026-10', rows: commissionFixturePeople.map(person => ({ ...person, period: '2026-10' })) }); download.mockClear(); ctx.appSession.membership = { role: 'OWNER', sections: null }; });
afterEach(cleanup);
it('loads monthly server projections and exports both original currencies through Reports', async () => {
  render(<ReportsScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Comisiones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled());
  expect(fetchReport).toHaveBeenCalledWith(ctx.user, expect.stringMatching(/^\d{4}-\d{2}$/), expect.stringMatching(/^\d{4}-\d{2}$/));
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
    ['2026-11', 'Martín Gómez', '0', '0', '0', '0', '0', '0', '-10', '0', '-10'],
  ]);
});
