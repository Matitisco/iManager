import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, RepairOrder, Sale, TradeIn } from '../types';
import type { AppSession } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { updateStoreApi, updateUserProfileApi } from '../services/settings-api';
import { completeBackendOnboarding } from '../services/onboarding-api';
import { acceptInvitation as acceptInvitationApi } from '../services/invitations-api';
import { readBootSession, writeBootSession } from '../lib/boot-cache';
import { fetchBackendSession } from '../services/backend-session';
import { fetchBackendInventory, updateBackendInventoryItem, createBackendInventoryItem, deleteBackendInventoryItem } from '../services/inventory-api';
import { fetchBackendClients, updateBackendClient, registerBackendClientPayment, createBackendClient, deleteBackendClient } from '../services/clients-api';
import { fetchBackendSales, updateBackendSale, deleteBackendSale } from '../services/sales-api';
import { fetchBackendTradeIns, updateBackendTradeIn, deleteBackendTradeIn } from '../services/trade-ins-api';
import { fetchBackendRepairs, updateBackendRepair, createBackendRepair, changeBackendRepairStatus, deleteBackendRepair, restoreBackendRepair } from '../services/repairs-api';
import { AppProvider, useAppContext } from './AppContext';

const auth = vi.hoisted(() => ({ listener: null as null | ((user: AuthUserLike | null) => void), adapter: { onAuthStateChanged: vi.fn(), logout: vi.fn(), getCurrentUser: vi.fn() } }));
vi.mock('../services/auth-adapter', () => ({ getAuthAdapter: () => auth.adapter }));
vi.mock('../lib/list-sync', async importOriginal => ({ ...await importOriginal<typeof import('../lib/list-sync')>(), publishListMutation: vi.fn() }));
vi.mock('../lib/analytics', () => ({ setAnalyticsUser: vi.fn() }));
vi.mock('../hooks/useBillingState', () => ({ useBillingState: () => ({}) }));
vi.mock('./cash-state', () => ({ useCashState: () => ({}) }));
vi.mock('./ledger-state', () => ({ useLedgerState: () => ({}) }));
vi.mock('./commission-state', () => ({ useCommissionState: () => ({}) }));
vi.mock('./public-catalog-state', () => ({ usePublicCatalogState: () => ({}) }));
vi.mock('./getting-started-state', () => ({ useGettingStartedState: () => ({}) }));
vi.mock('./returns-state', () => ({ useReturnsState: () => ({}) }));
vi.mock('../services/settings-api', () => ({ updateStoreApi: vi.fn(), updateUserProfileApi: vi.fn() }));
vi.mock('../services/onboarding-api', () => ({ completeBackendOnboarding: vi.fn() }));
vi.mock('../services/invitations-api', () => ({ acceptInvitation: vi.fn() }));
vi.mock('../services/backend-session', () => ({ fetchBackendSession: vi.fn() }));
vi.mock('../services/inventory-api', () => ({ fetchBackendInventory: vi.fn(), updateBackendInventoryItem: vi.fn(), createBackendInventoryItem: vi.fn(), deleteBackendInventoryItem: vi.fn() }));
vi.mock('../services/clients-api', () => ({ fetchBackendClients: vi.fn(), fetchClientCategoriesApi: vi.fn(async () => []), updateBackendClient: vi.fn(), registerBackendClientPayment: vi.fn(), createBackendClient: vi.fn(), deleteBackendClient: vi.fn() }));
vi.mock('../services/sales-api', () => ({ fetchBackendSales: vi.fn(), updateBackendSale: vi.fn(), deleteBackendSale: vi.fn() }));
vi.mock('../services/trade-ins-api', () => ({ fetchBackendTradeIns: vi.fn(), updateBackendTradeIn: vi.fn(), deleteBackendTradeIn: vi.fn() }));
vi.mock('../services/repairs-api', () => ({ fetchBackendRepairs: vi.fn(), updateBackendRepair: vi.fn(), createBackendRepair: vi.fn(), changeBackendRepairStatus: vi.fn(), deleteBackendRepair: vi.fn(), restoreBackendRepair: vi.fn() }));
vi.mock('../services/operations-api', () => ({ fetchNotifications: vi.fn(async () => ({ notifications: [] })), fetchOperationDrafts: vi.fn(async () => ({ tradeIns: [] })) }));

const session = { user: { id: 'u', firebaseUid: 'u', email: 'u@example.com', displayName: 'Owner' }, store: { id: 'store', name: 'Store', currency: 'ARS' }, membership: { role: 'OWNER', isDefault: true }, onboardingRequired: false } as AppSession;
const product = (id: string, model = 'Initial'): Product => ({ id, model, imei: '', capacity: '', color: '', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 10, price: 100, status: 'DISPONIBLE' });
const client = (id: string, name = 'Initial'): Client => ({ id, name, dni: '', phone: '', email: '', instagram: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 100 });
const repair = { id: 'r', clientName: 'Initial', device: 'Equipo' } as RepairOrder;
const sale = { id: 's', clientId: '', clientName: 'Initial', productId: '', amount: 100, status: 'COMPLETADA' } as Sale;
const trade = { id: 't', clientId: '', clientName: 'Initial' } as TradeIn;
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;
async function mount() {
  const hook = renderHook(useAppContext, { wrapper });
  await waitFor(() => expect(hook.result.current.sessionConfirmed && hook.result.current.listsLoaded).toBe(true));
  return hook;
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.adapter.onAuthStateChanged.mockImplementation(listener => { auth.listener = listener; return () => {}; });
  auth.adapter.getCurrentUser.mockReturnValue({ uid: 'u', email: 'u@example.com', getIdToken: async () => 'token' });
  writeBootSession({ uid: 'u', email: 'u@example.com', displayName: 'Owner', photoURL: null, session });
  vi.mocked(fetchBackendSession).mockResolvedValue({ status: 'ready', session, message: null });
  vi.mocked(fetchBackendInventory).mockResolvedValue([product('p'), product('p2')]);
  vi.mocked(fetchBackendClients).mockResolvedValue([client('c'), client('c2')]);
  vi.mocked(fetchBackendSales).mockResolvedValue([sale]);
  vi.mocked(fetchBackendTradeIns).mockResolvedValue([trade]);
  vi.mocked(fetchBackendRepairs).mockResolvedValue([repair]);
});

describe('AppContext concurrency #461', () => {
  it('does not roll back a newer successful optimistic product edit when an earlier edit fails', async () => {
    const { result } = await mount();
    const older = deferred<Product>(), newer = deferred<Product>();
    vi.mocked(updateBackendInventoryItem).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    vi.mocked(fetchBackendInventory).mockResolvedValue([product('p', 'Newer'), product('p2')]);
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.updateProduct(product('p', 'Older')); });
    const failed = a.catch(error => error);
    act(() => { b = result.current.updateProduct(product('p', 'Newer')); });
    await act(async () => { newer.resolve(product('p', 'Newer')); await b; });
    await act(async () => { older.reject(new Error('failed edit')); await failed; });
    expect(result.current.inventory.find(item => item.id === 'p')?.model).toBe('Newer');
    expect(await failed).toMatchObject({ message: 'failed edit' });
  });
  it('reconciles reversed successful responses against authoritative server state', async () => {
    const { result } = await mount();
    const older = deferred<Product>(), newer = deferred<Product>();
    vi.mocked(updateBackendInventoryItem).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    // The first HTTP response was delayed, but its write committed last.
    vi.mocked(fetchBackendInventory).mockResolvedValue([product('p', 'Committed last'), product('p2')]);
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.updateProduct(product('p', 'Older')); b = result.current.updateProduct(product('p', 'Newer')); });
    await act(async () => { newer.resolve(product('p', 'Newer')); await b; });
    await act(async () => { older.resolve(product('p', 'Older')); await a; });
    expect(result.current.inventory.find(item => item.id === 'p')?.model).toBe('Committed last');
  });
  it('keeps both independent successful client updates', async () => {
    const { result } = await mount();
    const a = deferred<Client>(), b = deferred<Client>();
    vi.mocked(updateBackendClient).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const readsBefore = vi.mocked(fetchBackendClients).mock.calls.length;
    let first!: Promise<void>, second!: Promise<void>;
    act(() => { first = result.current.updateClient(client('c', 'First')); second = result.current.updateClient(client('c2', 'Second')); });
    await act(async () => { b.resolve(client('c2', 'Second')); await second; });
    await act(async () => { a.resolve(client('c', 'First')); await first; });
    expect(result.current.clients.map(row => row.name)).toEqual(['First', 'Second']);
    expect(fetchBackendClients).toHaveBeenCalledTimes(readsBefore);
  });
  it('invalidates an initial list before product creation starts', async () => {
    const initial = deferred<Product[]>(), created = deferred<Product>();
    vi.mocked(fetchBackendInventory).mockReturnValueOnce(initial.promise).mockResolvedValue([product('existing'), product('created')]);
    vi.mocked(createBackendInventoryItem).mockReturnValue(created.promise);
    const { result } = renderHook(useAppContext, { wrapper });
    await waitFor(() => expect(result.current.sessionConfirmed && vi.mocked(fetchBackendInventory).mock.calls.length > 0).toBe(true));
    let write!: Promise<Product>;
    act(() => { write = result.current.addProduct(product('created')); });
    await act(async () => { created.resolve(product('created')); await write; });
    await act(async () => { initial.resolve([product('stale')]); });
    expect(result.current.inventory.map(row => row.id)).toEqual(['existing', 'created']);
  });
  it.each(['store', 'logout'])('ignores mutation completions and rollbacks after %s', async mode => {
    const { result } = await mount();
    const pending = deferred<Product>();
    vi.mocked(updateBackendInventoryItem).mockReturnValue(pending.promise);
    let write!: Promise<void>;
    act(() => { write = result.current.updateProduct(product('p', 'Pending')); });
    const failed = write.catch(error => error);
    if (mode === 'store') {
      vi.mocked(fetchBackendSession).mockResolvedValue({ status: 'ready', session: { ...session, store: { ...session.store!, id: 'other' } }, message: null });
      vi.mocked(fetchBackendInventory).mockResolvedValue([product('p', 'Other store')]);
      await act(() => result.current.reloadSession());
      await waitFor(() => expect(result.current.inventory[0]?.model).toBe('Other store'));
    } else {
      act(() => auth.listener?.(null));
      await waitFor(() => expect(result.current.inventory).toEqual([]));
    }
    await act(async () => { pending.reject(new Error('Failed old scope')); await failed; });
    expect(result.current.inventory.map(item => item.model)).toEqual(mode === 'store' ? ['Other store'] : []);
  });
  it.each(['inventory', 'clients', 'sales', 'tradeins'] as const)('ignores %s reload from the old store', async list => {
    const { result } = await mount();
    const pending = deferred<Array<Product & Client & Sale & TradeIn>>();
    const fetch = { inventory: fetchBackendInventory, clients: fetchBackendClients, sales: fetchBackendSales, tradeins: fetchBackendTradeIns }[list];
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    let read!: Promise<void>;
    act(() => { read = { inventory: result.current.reloadInventory, clients: result.current.reloadClients, sales: result.current.reloadSales, tradeins: result.current.reloadTradeIns }[list](); });
    act(() => auth.listener?.(null));
    await act(async () => { pending.resolve([{ ...product('stale'), ...client('stale'), ...sale, ...trade, id: 'stale' }]); await read; });
    expect(result.current.user).toBeNull();
    expect(result.current.inventory).toEqual([]);
    expect(result.current.clients).toEqual([]);
    expect(result.current.sales).toEqual([]);
    expect(result.current.tradeIns).toEqual([]);
  });
  it.each(['addProduct', 'updateClient', 'addClient', 'payment', 'updateSale', 'updateTrade', 'addRepair', 'updateRepair', 'repairStatus', 'restoreRepair'] as const)('guards %s completion after a store switch', async action => {
    const { result } = await mount();
    const pending = deferred<void>();
    vi.mocked(createBackendInventoryItem).mockReturnValue(pending.promise.then(() => product('late', 'Late')));
    vi.mocked(updateBackendClient).mockReturnValue(pending.promise.then(() => client('c', 'Late')));
    vi.mocked(createBackendClient).mockReturnValue(pending.promise.then(() => client('late', 'Late')));
    vi.mocked(registerBackendClientPayment).mockReturnValue(pending.promise.then(() => client('c', 'Late')));
    vi.mocked(updateBackendSale).mockReturnValue(pending.promise.then(() => ({ ...sale, clientName: 'Late' })));
    vi.mocked(updateBackendTradeIn).mockReturnValue(pending.promise.then(() => ({ ...trade, clientName: 'Late' })));
    vi.mocked(createBackendRepair).mockReturnValue(pending.promise.then(() => ({ order: { ...repair, device: 'Late' }, client: null })));
    vi.mocked(updateBackendRepair).mockReturnValue(pending.promise.then(() => ({ order: { ...repair, device: 'Late' }, client: null })));
    vi.mocked(changeBackendRepairStatus).mockReturnValue(pending.promise.then(() => ({ ...repair, device: 'Late' })));
    vi.mocked(restoreBackendRepair).mockReturnValue(pending.promise.then(() => ({ ...repair, device: 'Late' })));
    const actions = {
      addProduct: () => result.current.addProduct(product('late', 'Late')),
      updateClient: () => result.current.updateClient(client('c', 'Late')),
      addClient: () => result.current.addClient(client('late', 'Late')),
      payment: () => result.current.registerClientPayment('c', { amount: 10, method: 'EFECTIVO' }),
      updateSale: () => result.current.updateSale({ ...sale, clientName: 'Late' }),
      updateTrade: () => result.current.updateTradeIn({ ...trade, clientName: 'Late' }),
      addRepair: () => result.current.addRepairOrder({ device: 'Late' }),
      updateRepair: () => result.current.updateRepairOrder('r', { device: 'Late' }),
      repairStatus: () => result.current.changeRepairStatus('r', 'ENTREGADO'),
      restoreRepair: () => result.current.restoreRepairOrder('r'),
    };
    let write!: Promise<unknown>;
    act(() => { write = actions[action](); });
    vi.mocked(fetchBackendSession).mockResolvedValue({ status: 'ready', session: { ...session, store: { ...session.store!, id: 'other' } }, message: null });
    await act(() => result.current.reloadSession());
    await waitFor(() => expect(result.current.appSession?.store?.id).toBe('other'));
    await act(async () => { pending.resolve(); await write; });
    expect(result.current.inventory.some(row => row.model === 'Late')).toBe(false);
    expect(result.current.clients.some(row => row.name === 'Late')).toBe(false);
    expect(result.current.sales.some(row => row.clientName === 'Late')).toBe(false);
    expect(result.current.tradeIns.some(row => row.clientName === 'Late')).toBe(false);
    expect(result.current.repairOrders.some(row => row.device === 'Late')).toBe(false);
  });

  it('rolls back a failed product update even when the API rejects immediately', async () => {
    const { result } = await mount();
    vi.mocked(updateBackendInventoryItem).mockRejectedValue(new Error('Failed edit'));
    await act(async () => { await expect(result.current.updateProduct(product('p', 'Failed'))).rejects.toThrow('Failed edit'); });
    expect(result.current.inventory.find(row => row.id === 'p')?.model).toBe('Initial');
  });
  it('an old reload callback cannot invalidate the new store initial load', async () => {
    const { result } = await mount();
    const oldReload = result.current.reloadInventory;
    const current = deferred<Product[]>();
    vi.mocked(fetchBackendSession).mockResolvedValue({ status: 'ready', session: { ...session, store: { ...session.store!, id: 'other' } }, message: null });
    vi.mocked(fetchBackendInventory).mockReturnValueOnce(current.promise).mockResolvedValue([product('stale')]);
    await act(() => result.current.reloadSession());
    await waitFor(() => expect(fetchBackendInventory).toHaveBeenCalledTimes(2));
    await act(() => oldReload());
    await act(async () => { current.resolve([product('current', 'Other store')]); });
    expect(result.current.inventory.map(row => row.id)).toEqual(['current']);
  });

  it('guards an older response for the same client until authoritative reconciliation finishes', async () => {
    const { result } = await mount();
    const older = deferred<Client>(), newer = deferred<Client>(), authoritative = deferred<Client[]>();
    vi.mocked(updateBackendClient).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    vi.mocked(fetchBackendClients).mockReturnValue(authoritative.promise);
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.updateClient(client('c', 'Older')); b = result.current.updateClient(client('c', 'Newer')); });
    await act(async () => { newer.resolve(client('c', 'Newer')); await b; });
    await act(async () => { older.resolve(client('c', 'Older')); });
    expect(result.current.clients.find(row => row.id === 'c')?.name).toBe('Newer');
    await act(async () => { authoritative.resolve([client('c', 'Committed last'), client('c2')]); await a; });
    expect(result.current.clients.find(row => row.id === 'c')?.name).toBe('Committed last');
  });

  it.each(['store', 'profile', 'session', 'onboarding', 'invitation'] as const)('does not restore session data after logout during %s completion', async action => {
    const { result } = await mount();
    const pending = deferred<void>();
    vi.mocked(updateStoreApi).mockReturnValue(pending.promise.then(() => session.store!));
    vi.mocked(updateUserProfileApi).mockReturnValue(pending.promise.then(() => session.user));
    vi.mocked(fetchBackendSession).mockReturnValue(pending.promise.then(() => ({ status: 'ready', session, message: null })));
    vi.mocked(completeBackendOnboarding).mockReturnValue(pending.promise.then(() => session));
    vi.mocked(acceptInvitationApi).mockReturnValue(pending.promise.then(() => ({ session })));
    const actions = {
      store: () => result.current.updateStore({ name: 'Updated' }),
      profile: () => result.current.updateUserProfile({ displayName: 'Updated' }),
      session: () => result.current.reloadSession(),
      onboarding: () => result.current.completeOnboarding({ storeName: 'Updated' }),
      invitation: () => result.current.acceptStoreInvitation('token'),
    };
    let write!: Promise<void>;
    act(() => { write = actions[action](); });
    act(() => auth.listener?.(null));
    await waitFor(() => expect(result.current.appSession).toBeNull());
    await act(async () => { pending.resolve(); await write; });
    expect(result.current.user).toBeNull();
    expect(result.current.appSession).toBeNull();
    expect(result.current.backendStatus).toBe('checking');
    expect(readBootSession()).toBeNull();
  });

});
