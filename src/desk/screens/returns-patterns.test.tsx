import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatternGroupBy, ReturnCaseView, ReturnPatternView } from '../../services/returns-api';
import { DeskProvider } from '../ui';
import { returnPatternsHash, showSupplierPatterns } from '../returns-navigation';
import { PatternsScreen } from './PatternsScreen';
import { ReturnsPatterns } from './ReturnsPatterns';

const ctx = vi.hoisted(() => ({
  user: { uid: 'owner' }, backendStatus: 'ready', returns: [] as ReturnCaseView[], inventory: [], repairOrders: [], returnsError: '',
  appSession: { store: { id: 'store' }, membership: { role: 'OWNER', sections: null as string[] | null } },
}));
const layout = vi.hoisted(() => ({ phone: false }));
const api = vi.hoisted(() => ({ fetchReturnAnalysis: vi.fn(), fetchReturns: vi.fn(), fetchSupplierPurchase: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/returns-api', () => ({ fetchReturnAnalysis: api.fetchReturnAnalysis, fetchReturns: api.fetchReturns }));
vi.mock('../../services/suppliers-api', () => ({ fetchSupplierPurchase: api.fetchSupplierPurchase }));
vi.mock('../section-notices', async original => ({ ...await original<typeof import('../section-notices')>(), usePhoneLayout: () => layout.phone }));
vi.mock('../exchange', () => ({ useMoney: () => ({ show: (value: number) => `US$ ${value}` }) }));
const open = vi.fn();
const group: ReturnPatternView = {
  key: 'supplier', label: 'Importadora Andes', supplierId: 'supplier', purchaseId: null,
  devices: 11, problems: 4, percent: 36, hot: true, claims: 3, claimsTruncated: false,
  topReason: { family: 'bateria', label: 'batería', claims: 3 },
  claimsDetail: [
    { id: 'r3', caseNumber: 'RMA-0003', clientName: 'Julián Romero', deviceLabel: 'iPhone 11 64GB', imei: '356789104523871', reason: 'Batería al 70%', status: 'RESUELTO', rmaStatus: null, openedAt: '2026-10-21T15:00:00Z' },
    { id: 'r2', caseNumber: 'RMA-0002', clientName: 'Martín Acosta', deviceLabel: 'iPhone 14 Pro Max 256GB', imei: '', reason: 'Batería se descarga rápido', status: 'ABIERTO', rmaStatus: null, openedAt: '2026-10-20T15:00:00Z' },
    { id: 'r1', caseNumber: 'RMA-0001', clientName: 'Lucía Fernández', deviceLabel: 'iPhone 14 128GB', imei: '', reason: 'Batería baja a la semana', status: 'ABIERTO', rmaStatus: 'ENVIADO', openedAt: '2026-10-19T15:00:00Z' },
  ],
};
const purchaseGroup = { ...group, key: 'purchase', label: 'Importadora Andes · 05/09/2026 · Baterías', purchaseId: 'purchase' };
const coolGroup = { ...group, key: 'cool', label: 'Tech Cuyo', supplierId: 'cool', devices: 8, problems: 2, percent: 25, hot: false, topReason: null, claimsDetail: [], claims: 0 };
const zeroGroup = { ...coolGroup, key: 'zero', label: 'Sin problemas', problems: 0, percent: 0 };
const summary = { devices: 90, problems: 16, percent: 18, claims: 20, openClaims: 7, topReason: { family: 'bateria', label: 'batería', claims: 12 } };
const result = (patterns: ReturnPatternView[]) => ({ patterns, summary });
const tree = (node = <PatternsScreen />) => <div className="desk-app"><DeskProvider value={{ tab: 'patterns', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>{node}</DeskProvider></div>;
const mount = (node = <PatternsScreen />) => render(tree(node));
function navigate(hash: string) {
  act(() => {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, '', '#/comercial/devoluciones');
  layout.phone = false;
  ctx.appSession = { store: { id: 'store' }, membership: { role: 'OWNER', sections: null } };
  ctx.backendStatus = 'ready';
  ctx.inventory = [];
  ctx.returns = group.claimsDetail.map(claim => ({
    id: claim.id, code: claim.caseNumber, caseNumber: Number(claim.caseNumber.slice(-4)),
    clientName: claim.clientName, deviceLabel: claim.deviceLabel, imei: claim.imei,
    status: claim.status, rmaStatus: claim.rmaStatus, reason: claim.reason, events: [],
    saleId: null, clientId: null, inventoryItemId: null, supplierId: null, supplierName: null,
    diagnosis: null, openedOn: '2026-10-21', resolution: null, settlement: null, moneyAmount: 0,
    moneyCurrency: null, destination: null, stockStatus: null, previousStatus: null,
    resolvedOn: null, deletedAt: null, refundable: 0, saleAmount: 0, saleCurrency: 'USD',
    saleDate: null, warrantyDays: 0, itemCost: 0, itemCurrency: 'USD', creditNote: null,
  }));
  api.fetchReturnAnalysis.mockReset();
  api.fetchReturns.mockResolvedValue([]);
  api.fetchReturnAnalysis.mockImplementation((_user, by: PatternGroupBy) => Promise.resolve({ patterns: by === 'supplier' ? [group, coolGroup] : [], summary }));
  api.fetchSupplierPurchase.mockResolvedValue({ id: 'purchase', name: null, purchasedAt: '2026-09-05', notes: null, devices: 1, problemCount: 1, claimCount: 1, totalCost: 900, currency: 'USD', summary: { devices: 1, problems: 1 }, items: [
    { id: 'eq', model: 'iPhone 11', capacity: '64GB', imei: '356789104523871', status: 'EN_REVISION', cost: 900, currency: 'USD', problem: true, problemLabel: 'En revisión' },
  ] });
});

describe('Fallas', () => {
  it.each([false, true])('compares real metrics and rankings with mobile grouping (phone=%s)', async phone => {
    layout.phone = phone;
    api.fetchReturnAnalysis.mockImplementation((_user, by: PatternGroupBy) => Promise.resolve(result(by === 'purchase' ? [purchaseGroup] : by === 'model' ? [{ ...group, key: 'model', label: 'iPhone 11 · 64GB', supplierId: null }] : [group, coolGroup, zeroGroup])));
    mount();
    expect(screen.getByRole('heading', { name: 'Fallas', level: 1 })).toBeInTheDocument();
    const stats = await screen.findByLabelText('Resumen de fallas');
    expect(stats).toHaveTextContent('16 de 90');
    expect(stats).toHaveTextContent('batería');
    expect(stats).toHaveTextContent('12 de 20 reclamos');
    expect(stats.querySelectorAll('.dstat')).toHaveLength(phone ? 2 : 4);
    if (!phone) expect(stats).toHaveTextContent('En 16 equipos · 7 abiertos');
    expect(screen.queryByTestId('pattern-zero')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    if (phone) {
      expect(screen.getByRole('tab', { name: 'Proveedores' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('region', { name: 'Modelos con más fallas' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('tab', { name: 'Modelos' }));
      expect(await screen.findByRole('button', { name: 'Reclamos de iPhone 11 · 64GB' })).toBeVisible();
      expect(screen.queryByRole('region', { name: 'Proveedores' })).not.toBeInTheDocument();
    } else {
      for (const name of ['Proveedores', 'Compras', 'Modelos']) expect((await within(screen.getByRole('region', { name })).findAllByRole('button', { name: /Reclamos de/ })).length).toBeGreaterThan(0);
      const recent = screen.getByRole('region', { name: 'Reclamos recientes' });
      expect(within(recent).getAllByRole('button', { name: /Ver reclamo RMA/ })).toHaveLength(2);
      await userEvent.click(within(recent).getByRole('button', { name: 'Ver reclamo RMA-0003' }));
      expect(screen.getByRole('dialog', { name: 'Reclamo · RMA-0003' })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(within(recent).getByRole('button', { name: 'Ver reclamo RMA-0003' })).toHaveFocus());
    }
  });

  it('keeps a positive incident visible below one percent in summary, ranking and detail', async () => {
    api.fetchReturnAnalysis.mockResolvedValue({ patterns: [{ ...group, problems: 1, devices: 268, percent: 0 }], summary: { ...summary, problems: 1, devices: 268, percent: 0 } });
    mount();
    const stats = await screen.findByLabelText('Resumen de fallas');
    expect(stats).toHaveTextContent('<1%');
    expect(stats).toHaveTextContent('1 de 268');
    const row = within(screen.getByRole('region', { name: 'Proveedores' })).getByTestId('pattern-supplier');
    expect(row).toHaveTextContent('<1%');
    expect(row).toHaveTextContent('1 de 268 equipos');
    expect(row.querySelector('.pat-bar i')).toHaveStyle({ width: '2%' });
    expect(stats.querySelector('.bar i')).toHaveStyle({ width: '2%' });
    await userEvent.click(row);
    expect(screen.getByRole('dialog', { name: group.label })).toHaveTextContent('<1%');
  });

  it.each([false, true])('shows top three and opens all groups then a content-sized claims sheet (phone=%s)', async phone => {
    layout.phone = phone;
    const groups = Array.from({ length: 6 }, (_, i) => ({ ...group, key: `s${i}`, label: `Proveedor ${i}` }));
    api.fetchReturnAnalysis.mockResolvedValue(result(groups));
    mount(<ReturnsPatterns groupBy="supplier" />);
    await screen.findByTestId('pattern-s0');
    expect(screen.queryByTestId('pattern-s5')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos (6)' }));
    const all = screen.getByRole('dialog', { name: 'Fallas' });
    expect(within(all).getAllByRole('button', { name: /Reclamos de/ })).toHaveLength(6);
    await userEvent.click(within(all).getByRole('button', { name: 'Reclamos de Proveedor 5' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Proveedor 5' })).not.toHaveClass('pat-all-sheet');
    expect(screen.getByText('iPhone 11 64GB · Batería al 70%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /RMA-0001 · Lucía/ }));
    expect(open).not.toHaveBeenCalled();
    const claim = screen.getByRole('dialog', { name: 'Reclamo · RMA-0001' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await userEvent.click(within(claim).getByRole('button', { name: 'Ver historial (0)' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.queryByRole('dialog', { name: 'Proveedor 5' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Proveedor 5' })).toBeInTheDocument();
  });

  it.each(['supplier', 'purchase'] as const)('keeps fallback claims accessible without an origin action (%s)', async groupBy => {
    const label = groupBy === 'supplier' ? 'Sin proveedor asignado' : 'Sin compra asignada';
    api.fetchReturnAnalysis.mockResolvedValue(result([{ ...group, key: 'none', label, supplierId: null, purchaseId: null }]));
    mount(<ReturnsPatterns groupBy={groupBy} />);
    await userEvent.click(await screen.findByRole('button', { name: `Reclamos de ${label}` }));
    expect(screen.getByRole('dialog', { name: label })).toHaveTextContent('RMA-0003');
    expect(screen.queryByRole('button', { name: /Ver proveedor|Ver compra/ })).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('shows the illustrated group empty state without a nested box', async () => {
    api.fetchReturnAnalysis.mockResolvedValue(result([]));
    mount(<ReturnsPatterns groupBy="supplier" />);
    const empty = await screen.findByTestId('fallas-group-empty');
    expect(empty).toHaveTextContent('Sin reclamos');
    expect(empty).toHaveTextContent('No hay equipos con reclamo.');
    expect(empty).not.toHaveClass('wempty');
    expect(empty.querySelector('svg')).toHaveAttribute('width', '24');
  });

  it('clarifies resolved claims and preserves the raw reason across summary, ranking and recent claims', async () => {
    api.fetchReturnAnalysis.mockResolvedValue({ patterns: [{ ...group, claims: 1, problems: 1, topReason: { family: 'otro', label: 'asd', claims: 1 }, claimsDetail: [{ ...group.claimsDetail[0], reason: 'asd' }] }], summary: { ...summary, claims: 1, problems: 1, openClaims: 0, topReason: { family: 'otro', label: 'asd', claims: 1 } } });
    mount();
    const stats = await screen.findByLabelText('Resumen de fallas');
    expect(stats).toHaveTextContent('En 1 equipo · 0 abiertos');
    expect(stats.querySelector('.pat-reason-value')).toHaveTextContent('asd');
    expect(screen.getByRole('region', { name: 'Reclamos recientes' })).toHaveTextContent('asd');
  });

  it('shows server percentages, full denominator and primary reason on each ranking row', async () => {
    mount(<ReturnsPatterns groupBy="supplier" />);
    const row = await screen.findByTestId('pattern-supplier');
    expect(row).toHaveTextContent('4 de 11 equipos');
    expect(row).toHaveTextContent('36%');
    expect(row).toHaveTextContent('batería');
    expect(row.querySelector('.pat-bar i')).toHaveStyle({ width: '36%' });
  });

  it.each([false, true])('replaces the group with all claims and opens a nested claim (phone=%s)', async phone => {
    layout.phone = phone;
    const claims = [...group.claimsDetail, { ...group.claimsDetail[0], id: 'r4', caseNumber: 'RMA-0004' }];
    api.fetchReturnAnalysis.mockResolvedValue(result([{ ...group, claims: 80, claimsDetail: claims, claimsTruncated: true }]));
    mount(<ReturnsPatterns groupBy="supplier" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reclamos de Importadora Andes' }));
    expect(screen.getByRole('dialog').querySelectorAll('.return-row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos (80)' }));
    const all = screen.getByRole('dialog', { name: 'Todos los reclamos' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.querySelectorAll('.ov')).toHaveLength(1);
    expect(all).toHaveClass('sheet-frame');
    expect(all.querySelectorAll('.return-row')).toHaveLength(4);
    expect(all).toHaveTextContent('Mostrando 4 de 80 reclamos');
    const trigger = within(all).getByRole('button', { name: /RMA-0001 · Lucía/ });
    await userEvent.click(trigger);
    const detail = screen.getByRole('dialog', { name: 'Reclamo · RMA-0001' });
    expect(detail).toHaveClass('sheet-frame', 'rcl-detail');
    expect(detail.closest('.ov')).toHaveClass('subov');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(open).not.toHaveBeenCalled();
    await userEvent.click(within(detail).getByRole('button', { name: 'Ver historial (0)' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: 'Historial · RMA-0001' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Todos los reclamos' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    const restored = screen.getByRole('dialog', { name: 'Todos los reclamos' });
    await waitFor(() => expect(within(restored).getByRole('button', { name: /RMA-0001 · Lucía/ })).toHaveFocus());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: group.label })).toBeInTheDocument();
  });

  it('opens the supplier only from the detail action', async () => {
    mount(<ReturnsPatterns groupBy="supplier" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reclamos de Importadora Andes' }));
    expect(open).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver proveedor' }));
    expect(open).toHaveBeenCalledWith({ type: 'supplier', id: 'supplier' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps purchase detail and financial permissions without stacking the claims sheet', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['sales', 'inventory'] };
    api.fetchReturnAnalysis.mockResolvedValue(result([purchaseGroup]));
    mount(<ReturnsPatterns groupBy="purchase" />);
    await userEvent.click(await screen.findByRole('button', { name: `Reclamos de ${purchaseGroup.label}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver compra' }));
    expect(await screen.findByTestId('supplier-purchase-detail')).toBeInTheDocument();
    expect(api.fetchSupplierPurchase).toHaveBeenCalledWith(ctx.user, 'supplier', 'purchase');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getAllByText('US$ 900').length).toBeGreaterThan(0);
  });

  it('opens the linked group even outside the top five and can reopen the same supplier link', async () => {
    history.replaceState(null, '', returnPatternsHash('supplier', 'cool'));
    mount();
    expect(await screen.findByRole('dialog', { name: coolGroup.label })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    act(() => showSupplierPatterns('cool'));
    expect(await screen.findByRole('dialog', { name: coolGroup.label })).toBeInTheDocument();
  });

  it('selects the linked mobile grouping before opening its claims', async () => {
    layout.phone = true;
    history.replaceState(null, '', returnPatternsHash('purchase', 'purchase'));
    api.fetchReturnAnalysis.mockImplementation((_user, by: PatternGroupBy) => Promise.resolve(result(by === 'purchase' ? [purchaseGroup] : [group])));
    mount();
    expect(await screen.findByRole('dialog', { name: purchaseGroup.label })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Compras' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('region', { name: 'Compras con más fallas' })).toBeVisible();
  });

  it('does not open an unrelated group if the linked group no longer has claims', async () => {
    history.replaceState(null, '', returnPatternsHash('supplier', 'zero'));
    mount();
    await screen.findByTestId('pattern-supplier');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows one short empty line for the screen and no loading text', async () => {
    api.fetchReturnAnalysis.mockResolvedValue({ patterns: [], summary: { ...summary, devices: 0, problems: 0, claims: 0, percent: 0, topReason: null } });
    mount();
    expect(await screen.findByTestId('fallas-empty')).toHaveTextContent('No hay equipos con reclamo.');
    expect(screen.queryByRole('region', { name: 'Proveedores' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Resumen de fallas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cargando|No hay conexión/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('fallas-loading')).not.toBeInTheDocument();
  });

  it('shows failures distinctly from empty data and clears the initial skeleton', async () => {
    api.fetchReturnAnalysis.mockRejectedValue(new Error('Unavailable'));
    mount();
    expect(await screen.findAllByRole('alert')).toHaveLength(3);
    await waitFor(() => expect(document.querySelector('.pat-summary-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('fallas-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fallas-loading')).not.toBeInTheDocument();
  });

  it('preserves last valid rows and summary during revalidation and failure', async () => {
    const view = mount();
    await screen.findByTestId('pattern-supplier');
    const pending = deferred<ReturnType<typeof result>>();
    api.fetchReturnAnalysis.mockReturnValue(pending.promise);
    ctx.inventory = [];
    view.rerender(tree());
    expect(screen.getByTestId('pattern-supplier')).toBeInTheDocument();
    expect(screen.getByLabelText('Resumen de fallas')).toHaveTextContent('18%');
    expect(screen.queryByTestId('fallas-loading')).not.toBeInTheDocument();
    await act(async () => pending.resolve(result([coolGroup])));
    api.fetchReturnAnalysis.mockRejectedValue(new Error('Unavailable'));
    ctx.inventory = [];
    view.rerender(tree());
    expect(await screen.findAllByRole('alert')).toHaveLength(3);
    expect(screen.getAllByTestId('pattern-cool')).toHaveLength(3);
    expect(screen.getByLabelText('Resumen de fallas')).toHaveTextContent('18%');
  });

  it('does not reuse a previous store snapshot or its late response', async () => {
    const oldStore = deferred<ReturnType<typeof result>>();
    const newStore = deferred<ReturnType<typeof result>>();
    api.fetchReturnAnalysis.mockImplementation(() => ctx.appSession.store.id === 'store' ? oldStore.promise : newStore.promise);
    const view = mount();
    ctx.appSession = { ...ctx.appSession, store: { id: 'other-store' } };
    view.rerender(tree());
    await act(async () => newStore.resolve(result([coolGroup])));
    await act(async () => oldStore.resolve(result([group])));
    expect(screen.getAllByTestId('pattern-cool')).toHaveLength(3);
    expect(screen.queryByTestId('pattern-supplier')).not.toBeInTheDocument();
  });

  it('closes detail if its group loses its claims on refresh', async () => {
    const view = mount(<ReturnsPatterns groupBy="supplier" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reclamos de Importadora Andes' }));
    api.fetchReturnAnalysis.mockResolvedValue(result([coolGroup]));
    ctx.inventory = [];
    view.rerender(tree(<ReturnsPatterns groupBy="supplier" />));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('pattern-cool')).toBeInTheDocument();
  });

  it('permits sales-only access while hiding origin links', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['sales'] };
    mount(<ReturnsPatterns groupBy="supplier" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reclamos de Importadora Andes' }));
    expect(screen.queryByRole('button', { name: /Ver proveedor|Ver compra/ })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('never queries without sales access or a ready business session', () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['inventory'] };
    const view = mount();
    expect(api.fetchReturnAnalysis).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fallas-loading')).not.toBeInTheDocument();
    view.unmount();
    ctx.appSession.membership = { role: 'OWNER', sections: null };
    ctx.backendStatus = 'checking';
    mount();
    expect(api.fetchReturnAnalysis).not.toHaveBeenCalled();
  });
});
