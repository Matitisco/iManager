import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatternGroupBy, ReturnPatternView } from '../../services/returns-api';
import { DeskProvider } from '../ui';
import { returnPatternsHash, showSupplierPatterns } from '../returns-navigation';
import { ReturnsScreen } from './ReturnsScreen';
import { ReturnsPatterns } from './ReturnsPatterns';

const ctx = vi.hoisted(() => ({
  user: { uid: 'owner' }, backendStatus: 'ready', returns: [], inventory: [], repairOrders: [], returnsError: '',
  appSession: { store: { id: 'store' }, membership: { role: 'OWNER', sections: null as string[] | null } },
}));
const layout = vi.hoisted(() => ({ phone: false }));
const api = vi.hoisted(() => ({ fetchReturnPatterns: vi.fn(), fetchReturns: vi.fn(), fetchSupplierPurchase: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/returns-api', () => ({ fetchReturnPatterns: api.fetchReturnPatterns, fetchReturns: api.fetchReturns }));
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
const tree = (node = <ReturnsScreen />) => <div className="desk-app"><DeskProvider value={{ tab: 'returns', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>{node}</DeskProvider></div>;
const mount = (node = <ReturnsScreen />) => render(tree(node));
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
  api.fetchReturns.mockResolvedValue([]);
  api.fetchReturnPatterns.mockResolvedValue([group, coolGroup]);
  api.fetchSupplierPurchase.mockResolvedValue({ id: 'purchase', name: null, purchasedAt: '2026-09-05', notes: null, devices: 1, problemCount: 1, claimCount: 1, totalCost: 900, currency: 'USD', summary: { devices: 1, problems: 1 }, items: [
    { id: 'eq', model: 'iPhone 11', capacity: '64GB', imei: '356789104523871', status: 'EN_REVISION', cost: 900, currency: 'USD', problem: true, problemLabel: 'En revisión' },
  ] });
});

describe('Patrones de Devoluciones', () => {
  describe.each([false, true])('filtering with phone layout = %s', phone => {
    it.each(['supplier', 'purchase', 'model'] as const)('hides zero-problem %s groups and expands the first visible group', async groupBy => {
      layout.phone = phone;
      api.fetchReturnPatterns.mockResolvedValueOnce([zeroGroup, { ...group, problems: 1, percent: 0 }, coolGroup]);
      mount(<ReturnsPatterns groupBy={groupBy} />);
      const first = await screen.findByTestId('pattern-supplier');
      expect(api.fetchReturnPatterns).toHaveBeenCalledWith(ctx.user, groupBy);
      expect(screen.queryByTestId('pattern-zero')).not.toBeInTheDocument();
      expect(screen.queryByText(zeroGroup.label)).not.toBeInTheDocument();
      expect(first).toHaveClass('on');
      expect(screen.getByTestId('pattern-cool')).not.toHaveClass('on');
      expect(screen.getAllByRole('region')).toHaveLength(1);
      expect(screen.getByRole('region', { name: `Reclamos de ${group.label}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Reclamos de ${group.label}` })).toHaveAttribute('aria-expanded', 'true');
      expect(first.querySelector('.pat-pct')).toHaveTextContent('0%');
    });

    it.each(['supplier', 'purchase', 'model'] as const)('keeps the existing empty state when every %s group has zero problems', async groupBy => {
      layout.phone = phone;
      api.fetchReturnPatterns.mockResolvedValueOnce([zeroGroup]);
      const { container } = mount(<ReturnsPatterns groupBy={groupBy} requestedGroup={zeroGroup.key} />);
      await waitFor(() => expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument());
      expect(screen.queryByTestId('returns-patterns')).not.toBeInTheDocument();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
      expect(container.querySelector('.desk-app')).toBeEmptyDOMElement();
    });
  });

  it('switches between claims and all three server groupings without mixing rows', async () => {
    api.fetchReturnPatterns.mockImplementation((_user, by: PatternGroupBy) => Promise.resolve(by === 'purchase' ? [purchaseGroup] : by === 'model' ? [{ ...group, key: 'model', label: 'iPhone 11 · 64GB', supplierId: null }] : [group]));
    mount();
    expect(api.fetchReturnPatterns).not.toHaveBeenCalled();
    navigate(returnPatternsHash());
    await screen.findByTestId('pattern-supplier');
    expect(api.fetchReturnPatterns).toHaveBeenLastCalledWith(ctx.user, 'supplier');
    expect(screen.queryByRole('group', { name: 'Estado' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }));
    await screen.findByTestId('pattern-purchase');
    expect(api.fetchReturnPatterns).toHaveBeenLastCalledWith(ctx.user, 'purchase');
    expect(screen.queryByTestId('pattern-supplier')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Modelo' }));
    await screen.findByTestId('pattern-model');
    expect(api.fetchReturnPatterns).toHaveBeenLastCalledWith(ctx.user, 'model');
    expect(screen.queryByText('Ver proveedor')).not.toBeInTheDocument();
    navigate('#/comercial/devoluciones?view=claims');
    expect(screen.getByRole('group', { name: 'Estado' })).toBeInTheDocument();
    expect(screen.queryByTestId('returns-patterns')).not.toBeInTheDocument();
  });

  it('uses server hot/percent, renders the complete claim reason and real status colors', async () => {
    mount(<ReturnsPatterns groupBy="supplier" />);
    const hot = await screen.findByTestId('pattern-supplier');
    expect(hot).toHaveClass('hot', 'on');
    expect(hot).toHaveTextContent('4 de 11 equipos');
    expect(hot.querySelector('.pat-bar i')).toHaveStyle({ width: '36%' });
    expect(screen.getByTestId('pattern-cool')).not.toHaveClass('hot');
    expect(screen.getByTestId('pattern-cool').querySelector('.pat-bar i')).toHaveStyle({ width: '25%' });
    expect(screen.getByTestId('pattern-reason')).toHaveTextContent('3 de 3 reclamos son por batería');
    expect(screen.getByText('iPhone 11 64GB · Batería al 70%')).toBeInTheDocument();
    expect(screen.getByText('Resuelto')).toBeInTheDocument();
    expect(screen.getByText('Enviado').getAttribute('style')).toContain('#5B8DEF');
    await userEvent.click(screen.getByRole('button', { name: /RMA-0001 · Lucía/ }));
    expect(open).toHaveBeenCalledWith({ type: 'return', id: 'r1' });
  });

  it('only shows a reason when supplied, using total claims even when truncated', async () => {
    api.fetchReturnPatterns.mockResolvedValueOnce([{ ...group, claims: 80, topReason: { family: 'pantalla', label: 'pantalla', claims: 60 }, claimsTruncated: true }]);
    mount(<ReturnsPatterns groupBy="supplier" />);
    expect(await screen.findByTestId('pattern-reason')).toHaveTextContent('60 de 80 reclamos son por pantalla');
    expect(screen.getByText('Mostrando 3 de 80 reclamos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reclamos de Importadora Andes' }));
    expect(screen.queryByTestId('pattern-reason')).not.toBeInTheDocument();
  });

  it('expands one inline region on mobile and opens the supplier from the name', async () => {
    layout.phone = true;
    mount(<ReturnsPatterns groupBy="supplier" />);
    await screen.findByTestId('pattern-supplier');
    expect(screen.getByRole('region').parentElement).toHaveClass('pat-group');
    const cool = screen.getByRole('button', { name: 'Reclamos de Tech Cuyo' });
    await userEvent.click(cool);
    expect(cool).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.queryByTestId('pattern-reason')).not.toBeInTheDocument();
    await userEvent.click(cool);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver proveedor: Importadora Andes' }));
    expect(open).toHaveBeenCalledWith({ type: 'supplier', id: 'supplier' });
  });

  it('opens the existing purchase sheet and hides costs without financial permission', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['sales', 'inventory'] };
    api.fetchReturnPatterns.mockResolvedValueOnce([purchaseGroup]);
    mount(<ReturnsPatterns groupBy="purchase" />);
    await userEvent.click(await screen.findByRole('button', { name: `Ver compra: ${purchaseGroup.label}` }));
    const detail = await screen.findByTestId('supplier-purchase-detail');
    expect(api.fetchSupplierPurchase).toHaveBeenCalledWith(ctx.user, 'supplier', 'purchase');
    expect(screen.getByRole('dialog', { name: 'Compra del 05/09/2026' })).toBeInTheDocument();
    expect(within(detail).getByText('IMEI 356789104523871')).toBeInTheDocument();
    expect(within(detail).getByText('En revisión')).toBeInTheDocument();
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByTestId('pattern-purchase')).toHaveClass('on');
  });

  it('opens from a supplier link with the requested group selected instead of the first', async () => {
    history.replaceState(null, '', returnPatternsHash('supplier', 'cool'));
    mount();
    await screen.findByTestId('pattern-cool');
    expect(screen.queryByRole('group', { name: 'Vista' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Agrupar' })).toBeInTheDocument();
    expect(screen.getByTestId('pattern-cool')).toHaveClass('on');
    expect(screen.getByTestId('pattern-supplier')).not.toHaveClass('on');
    expect(screen.queryByTestId('pattern-reason')).not.toBeInTheDocument();
  });

  it.each(['supplier', 'purchase'] as const)('falls back to the first visible group when the linked %s has no problems', async groupBy => {
    api.fetchReturnPatterns.mockResolvedValueOnce([zeroGroup, group, coolGroup]);
    history.replaceState(null, '', returnPatternsHash(groupBy, zeroGroup.key));
    mount();
    expect(await screen.findByTestId('pattern-supplier')).toHaveClass('on');
    expect(screen.queryByTestId('pattern-zero')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: `Reclamos de ${group.label}` })).toBeInTheDocument();
    expect(screen.getByTestId('pattern-cool')).not.toHaveClass('on');
  });

  it('selects the first remaining group if the expanded group loses its problems on refresh', async () => {
    const pending = deferred<ReturnPatternView[]>();
    api.fetchReturnPatterns.mockResolvedValueOnce([group, coolGroup]).mockReturnValueOnce(pending.promise);
    const view = mount(<ReturnsPatterns groupBy="supplier" />);
    await screen.findByTestId('pattern-supplier');
    await userEvent.click(screen.getByRole('button', { name: `Reclamos de ${coolGroup.label}` }));
    expect(screen.getByTestId('pattern-cool')).toHaveClass('on');
    ctx.inventory = [];
    view.rerender(tree(<ReturnsPatterns groupBy="supplier" />));
    expect(screen.getByTestId('pattern-cool')).toHaveClass('on');
    expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument();
    await act(async () => pending.resolve([group, { ...coolGroup, problems: 0, percent: 0 }]));
    expect(screen.queryByTestId('pattern-cool')).not.toBeInTheDocument();
    expect(screen.getByTestId('pattern-supplier')).toHaveClass('on');
    expect(screen.getByRole('region', { name: `Reclamos de ${group.label}` })).toBeInTheDocument();
  });

  it('reopens supplier patterns even when the URL already matches a locally changed view', async () => {
    history.replaceState(null, '', returnPatternsHash('supplier', 'supplier'));
    mount();
    await screen.findByTestId('pattern-supplier');
    navigate('#/comercial/devoluciones?view=claims');
    expect(screen.queryByTestId('returns-patterns')).not.toBeInTheDocument();
    act(() => showSupplierPatterns('supplier'));
    await screen.findByTestId('pattern-supplier');
    expect(screen.getByTestId('pattern-supplier')).toHaveClass('on');
  });

  it('shows a skeleton while pending, then no filler for an empty result', async () => {
    const pending = deferred<ReturnPatternView[]>();
    api.fetchReturnPatterns.mockReturnValueOnce(pending.promise);
    mount(<ReturnsPatterns groupBy="supplier" />);
    expect(screen.getByTestId('patterns-loading')).toBeInTheDocument();
    expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('returns-patterns')).not.toBeInTheDocument();
    await act(async () => pending.resolve([]));
    expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('returns-patterns')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin datos|No hay|Todavía/)).not.toBeInTheDocument();
  });

  it('omits failed secondary analysis without alerts or retry buttons', async () => {
    api.fetchReturnPatterns.mockRejectedValueOnce(new Error('Unavailable'));
    mount(<ReturnsPatterns groupBy="supplier" />);
    await waitFor(() => expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reintentar|No hay conexión|Unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('returns-patterns')).not.toBeInTheDocument();
  });

  it('ignores a late supplier response after switching to purchase', async () => {
    const pending = deferred<ReturnPatternView[]>();
    api.fetchReturnPatterns.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([purchaseGroup]);
    history.replaceState(null, '', returnPatternsHash());
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }));
    await screen.findByTestId('pattern-purchase');
    await act(async () => pending.resolve([group]));
    expect(screen.queryByTestId('pattern-supplier')).not.toBeInTheDocument();
    expect(screen.getByTestId('pattern-purchase')).toBeInTheDocument();
  });

  it('keeps a completed grouping while revalidating instead of flashing skeletons', async () => {
    api.fetchReturnPatterns.mockResolvedValueOnce([group]).mockResolvedValueOnce([purchaseGroup]);
    history.replaceState(null, '', returnPatternsHash());
    mount();
    await screen.findByTestId('pattern-supplier');
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }));
    await screen.findByTestId('pattern-purchase');
    const pending = deferred<ReturnPatternView[]>();
    api.fetchReturnPatterns.mockReturnValueOnce(pending.promise);
    await userEvent.click(screen.getByRole('button', { name: 'Proveedor' }));
    expect(screen.getByTestId('pattern-supplier')).toBeInTheDocument();
    expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument();
    await act(async () => pending.resolve([group]));
  });

  it('does not reuse a previous store snapshot or its late response', async () => {
    const oldStore = deferred<ReturnPatternView[]>();
    const newStore = deferred<ReturnPatternView[]>();
    api.fetchReturnPatterns.mockReturnValueOnce(oldStore.promise).mockReturnValueOnce(newStore.promise);
    history.replaceState(null, '', returnPatternsHash());
    const view = mount();
    ctx.appSession = { ...ctx.appSession, store: { id: 'other-store' } };
    view.rerender(tree());
    await act(async () => newStore.resolve([coolGroup]));
    await act(async () => oldStore.resolve([group]));
    expect(screen.getByTestId('pattern-cool')).toBeInTheDocument();
    expect(screen.queryByTestId('pattern-supplier')).not.toBeInTheDocument();
  });

  it('keeps completed data during a temporary session reconnect without another skeleton', async () => {
    const view = mount(<ReturnsPatterns groupBy="supplier" />);
    await screen.findByTestId('pattern-supplier');
    ctx.backendStatus = 'checking';
    view.rerender(tree(<ReturnsPatterns groupBy="supplier" />));
    expect(screen.getByTestId('pattern-supplier')).toBeInTheDocument();
    expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument();
  });

  it('allows analysis with sales access alone but hides inventory links', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['sales'] };
    mount(<ReturnsPatterns groupBy="supplier" />);
    await screen.findByTestId('pattern-supplier');
    expect(screen.queryByRole('button', { name: /Ver proveedor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver compra/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('pattern-reason')).toBeInTheDocument();
  });

  it('never queries patterns without returns access or before a business session is ready', () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['inventory'] };
    const view = mount(<ReturnsPatterns groupBy="supplier" />);
    expect(api.fetchReturnPatterns).not.toHaveBeenCalled();
    expect(screen.queryByTestId('patterns-loading')).not.toBeInTheDocument();
    view.unmount();
    ctx.appSession.membership = { role: 'OWNER', sections: null };
    ctx.backendStatus = 'checking';
    mount(<ReturnsPatterns groupBy="supplier" />);
    expect(api.fetchReturnPatterns).not.toHaveBeenCalled();
  });
});
