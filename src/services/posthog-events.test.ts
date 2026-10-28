import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { capture, deviceAdded, identify, observeInventory } from '../lib/posthog-analytics';
import { completeBackendOnboarding } from './onboarding-api';
import { acceptInvitation, createInvitation } from './invitations-api';
import { importBackendRows } from './import-api';
import { createBackendInventoryBatch, createBackendInventoryItem, fetchBackendInventory } from './inventory-api';
import { confirmTradeOperation, createOperation, updateSaleOperation } from './operations-api';
import type { AppSession } from '../types/app-session';
import type { Product } from '../types';

vi.mock('./api-client', async importOriginal => ({ ...await importOriginal<typeof import('./api-client')>(), apiRequest: vi.fn() }));
vi.mock('../lib/posthog-analytics', () => ({ capture: vi.fn(), deviceAdded: vi.fn(), identify: vi.fn(), observeInventory: vi.fn() }));
const user = { uid: 'firebase-u', email: 'private@example.com', displayName: 'Private Owner', getIdToken: async () => 'secret' };
const session = { user: { id: 'internal-u' }, store: { id: 'internal-s', name: 'Private Store' }, membership: { role: 'OWNER' } } as AppSession;
const product = { id: 'device', model: 'Private Model', imei: 'private-imei', cost: 999, price: 1234 } as Product;
beforeEach(() => { vi.resetAllMocks(); });

describe('successful PostHog business events', () => {
  it('identifies after store creation and emits only the completed step', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ session });
    await completeBackendOnboarding(user, { storeName: 'Private Store' });
    expect(identify).toHaveBeenCalledWith('internal-u', 'internal-s', 'OWNER');
    expect(capture).toHaveBeenCalledExactlyOnceWith('onboarding_step_completed', { step: 'store' });
  });
  it('emits invitation creation and acceptance without email or token', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ token: 'secret' }).mockResolvedValueOnce({ session });
    await createInvitation(user, 'private@example.com', 'STAFF');
    await acceptInvitation(user, 'secret');
    expect(identify).toHaveBeenCalledWith('internal-u', 'internal-s', 'OWNER');
    expect(vi.mocked(capture).mock.calls).toEqual([['employee_invite_sent'], ['employee_invite_accepted']]);
  });
  it('observes inventory only after a read and signals successful single and batch additions', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ inventory: [] }).mockResolvedValueOnce({ inventoryItem: product }).mockResolvedValueOnce({ created: [product], errors: [] });
    await fetchBackendInventory(user); await createBackendInventoryItem(user, product); await createBackendInventoryBatch(user, [product]);
    expect(observeInventory).toHaveBeenCalledExactlyOnceWith(0);
    expect(deviceAdded).toHaveBeenCalledTimes(2);
    expect(capture).not.toHaveBeenCalled();
  });
  it('reports aggregate and legacy counts on a partial import without private data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ imported: 2, updated: 1, errors: [{ row: 4, message: 'private customer' }] });
    await importBackendRows(user, 'inventory', Array.from({ length: 4 }, () => ({ model: 'Private Model', imei: 'private-imei', price: 1234 })));
    expect(vi.mocked(capture).mock.calls).toEqual([
      ['import_result', { import_type: 'inventory', source: 'excel', phase: 'commit',
        rows_detected: 4, rows_prepared: 4, rows_imported: 2, rows_updated: 1, rows_discarded: 1,
        discarded_by_reason: {}, missing_required_fields: [], missing_recommended_fields: [] }],
      ['excel_import_succeeded', { rows: 3 }], ['excel_import_failed', { rows: 1 }],
    ]);
    expect(JSON.stringify(vi.mocked(capture).mock.calls).toLowerCase()).not.toContain('private');
    expect(deviceAdded).toHaveBeenCalledOnce();
  });
  it('does not label pasted text as Excel, while still observing device additions', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ imported: 1, updated: 0, errors: [] });
    await importBackendRows(user, 'inventory', [{ model: 'Private' }], undefined, 'text');
    expect(capture).toHaveBeenCalledExactlyOnceWith('import_result', {
      import_type: 'inventory', source: 'text', phase: 'commit',
      rows_detected: 1, rows_prepared: 1, rows_imported: 1, rows_updated: 0, rows_discarded: 0,
      discarded_by_reason: {}, missing_required_fields: [], missing_recommended_fields: [],
    });
    expect(deviceAdded).toHaveBeenCalledOnce();
  });
  it('emits sale and trade only when returned by a successful creation, and sale on draft confirmation', async () => {
    const result = { sale: { id: 's', amount: 1234, clientName: 'Private Client' }, tradeIn: { id: 't' }, inventory: [], clients: [], notifications: [] };
    vi.mocked(apiRequest).mockResolvedValueOnce(result).mockResolvedValueOnce({ tradeIn: result.tradeIn }).mockResolvedValueOnce(result).mockResolvedValueOnce(result);
    await createOperation(user, 'sales', { amount: 1234, clientName: 'Private Client', tradeIn: { deviceReceived: 'Private Model', takeValue: 999 } });
    await createOperation(user, 'tradeins', { draft: true, tradeIn: { deviceReceived: 'Private Model', takeValue: 999 } });
    await confirmTradeOperation(user, 'tradeins', 't', {});
    await updateSaleOperation(user, 's', {});
    expect(vi.mocked(capture).mock.calls).toEqual([['sale_created'], ['trade_in_created'], ['trade_in_created'], ['sale_created']]);
  });
  it('preserves rejected writes and emits no successful events', async () => {
    const error = new Error('private server error'); vi.mocked(apiRequest).mockRejectedValue(error);
    await expect(completeBackendOnboarding(user, { storeName: 'Private' })).rejects.toBe(error);
    await expect(createInvitation(user, undefined, 'STAFF')).rejects.toBe(error);
    await expect(acceptInvitation(user, 'secret')).rejects.toBe(error);
    await expect(createOperation(user, 'sales', { amount: 1234 })).rejects.toBe(error);
    await expect(createBackendInventoryItem(user, product)).rejects.toBe(error);
    expect(capture).not.toHaveBeenCalled(); expect(deviceAdded).not.toHaveBeenCalled(); expect(identify).not.toHaveBeenCalled();
    await expect(importBackendRows(user, 'clients', [{ name: 'Private Customer' }])).rejects.toThrow('Se perdió la conexión durante la importación. Revisá tu conexión y volvé a intentarlo.');
    expect(capture).toHaveBeenCalledExactlyOnceWith('excel_import_failed', { rows: 1 });
  });
});
