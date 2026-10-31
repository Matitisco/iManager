import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { capture, deviceAdded, identify, observeInventory } from '../lib/posthog-analytics';
import { completeBackendOnboarding } from './onboarding-api';
import { acceptInvitation, createInvitation } from './invitations-api';
import { importBackendRows } from './import-api';
import { createBackendInventoryBatch, createBackendInventoryItem, fetchBackendInventory } from './inventory-api';
import { cancelSaleOperation, confirmTradeOperation, createOperation, restoreSaleOperation, updateSaleOperation } from './operations-api';
import type { AppSession } from '../types/app-session';
import type { Product } from '../types';
import type { OperationResult } from './operations-api';

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
  it('reports aggregate and legacy counts on a complete import without private data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ imported: 2, updated: 2, errors: [] });
    await importBackendRows(user, 'inventory', Array.from({ length: 4 }, () => ({ model: 'Private Model', imei: 'private-imei', price: 1234 })));
    expect(vi.mocked(capture).mock.calls).toEqual([
      ['import_result', { import_type: 'inventory', source: 'excel', phase: 'commit',
        rows_detected: 4, rows_prepared: 4, rows_imported: 2, rows_updated: 2, rows_discarded: 0,
        discarded_by_reason: {}, missing_required_fields: [], missing_recommended_fields: [] }],
      ['excel_import_succeeded', { rows: 4 }],
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
  it('emits sale and trade only on successful creation and sale on draft confirmation', async () => {
    const result = { sale: { id: 's', amount: 1234, clientName: 'Private Client' }, tradeIn: { id: 't' }, inventory: [], clients: [], notifications: [] };
    vi.mocked(apiRequest).mockResolvedValueOnce(result).mockResolvedValueOnce({ tradeIn: result.tradeIn }).mockResolvedValueOnce(result);
    await createOperation(user, 'sales', { amount: 1234, clientName: 'Private Client', tradeIn: { deviceReceived: 'Private Model', takeValue: 999 } });
    await createOperation(user, 'tradeins', { draft: true, tradeIn: { deviceReceived: 'Private Model', takeValue: 999 } });
    await confirmTradeOperation(user, 'tradeins', 't', {});
    const props = { quantity: 1, unit_price: 1234, total: 1234, sale_id: 's' };
    expect(vi.mocked(capture).mock.calls).toEqual([['sale_created', props], ['trade_in_created'], ['trade_in_created'], ['sale_created', props]]);
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

const soldProduct = { ...product, model: 'iPhone 16 Pro', capacity: '256 GB', cantidad: 3 };
function saleResult(overrides: Partial<NonNullable<OperationResult['sale']>> = {}): OperationResult {
  return {
    sale: { id: 'sale-1', date: '30/10/2026', clientId: 'private-client', clientName: 'Private Customer',
      productId: soldProduct.id, cantidad: 5, amount: 4000, amountCurrency: 'USD',
      stockDeducted: true, status: 'COMPLETADA', paymentMethod: 'private-payment', ...overrides },
    inventory: [soldProduct], clients: [], notifications: [], summary: 'Saved',
  };
}

describe('sale_created details', () => {
  it('uses the saved quantity and total for 5 × USD 800 and includes remaining stock', async () => {
    vi.mocked(apiRequest).mockResolvedValue(saleResult());
    await createOperation(user, 'sales', { cantidad: 1, amount: 800, unitPrice: 999, currency: 'ARS' });
    expect(capture).toHaveBeenCalledExactlyOnceWith('sale_created', {
      quantity: 5, unit_price: 800, total: 4000, currency: 'USD', model: 'iPhone 16 Pro', capacity: '256 GB',
      stock_deducted: true, stock_left: 3, sale_id: 'sale-1', status: 'COMPLETADA',
    });
  });

  it('reports a single unit and zero remaining stock', async () => {
    const result = saleResult({ cantidad: 1, amount: 800 });
    result.inventory = [{ ...soldProduct, cantidad: 0 }];
    vi.mocked(apiRequest).mockResolvedValue(result);
    await createOperation(user, 'sales', {});
    expect(capture).toHaveBeenCalledExactlyOnceWith('sale_created', {
      quantity: 1, unit_price: 800, total: 800, currency: 'USD', model: 'iPhone 16 Pro', capacity: '256 GB',
      stock_deducted: true, stock_left: 0, sale_id: 'sale-1', status: 'COMPLETADA',
    });
  });

  it.each([{ inventory: [] }, { inventory: [soldProduct] }])('omits remaining stock when stock was not deducted: %j', async ({ inventory }) => {
    const result = { ...saleResult({ stockDeducted: false }), inventory };
    vi.mocked(apiRequest).mockResolvedValue(result);
    await createOperation(user, 'sales', {});
    expect(capture).toHaveBeenCalledOnce();
    expect(vi.mocked(capture).mock.calls[0][1]).toMatchObject({ stock_deducted: false });
    expect(vi.mocked(capture).mock.calls[0][1]).not.toHaveProperty('stock_left');
  });

  it('omits product details and remaining stock when the sold product is missing', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...saleResult(), inventory: [{ ...soldProduct, id: 'other-product' }] });
    await createOperation(user, 'sales', { deviceLabel: 'private-label' });
    const props = vi.mocked(capture).mock.calls[0][1];
    expect(props).toMatchObject({ stock_deducted: true });
    for (const key of ['stock_left', 'model', 'capacity']) expect(props).not.toHaveProperty(key);
  });

  it('uses the sold product rather than the received device when confirming a draft', async () => {
    const result = saleResult({ status: 'PENDIENTE' });
    result.inventory = [{ ...soldProduct, id: 'incoming', model: 'Incoming Device', cantidad: 1 }, soldProduct];
    vi.mocked(apiRequest).mockResolvedValue(result);
    await confirmTradeOperation(user, 'tradeins', 'draft-1', { cantidad: 1, amount: 800 });
    expect(capture).toHaveBeenCalledExactlyOnceWith('sale_created', {
      quantity: 5, unit_price: 800, total: 4000, currency: 'USD', model: 'iPhone 16 Pro', capacity: '256 GB',
      stock_deducted: true, stock_left: 3, sale_id: 'sale-1', status: 'PENDIENTE',
    });
  });

  it('uses input quantity/currency only when absent from the saved sale and rounds the unit price', async () => {
    vi.mocked(apiRequest).mockResolvedValue(saleResult({ cantidad: undefined, amountCurrency: null, amount: 100 }));
    await createOperation(user, 'sales', { cantidad: 3, currency: 'ARS' });
    expect(vi.mocked(capture).mock.calls[0][1]).toMatchObject({ quantity: 3, unit_price: 33.33, total: 100, currency: 'ARS' });
  });

  it('omits missing legacy fields and defaults the quantity to one', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...saleResult({ cantidad: undefined, amountCurrency: null, stockDeducted: undefined, status: 'CANCELADA' }), inventory: [] });
    await createOperation(user, 'sales', {});
    expect(capture).toHaveBeenCalledExactlyOnceWith('sale_created', { quantity: 1, unit_price: 4000, total: 4000, sale_id: 'sale-1' });
  });

  it('never includes customer, IMEI, notes, payment or free text as keys or values', async () => {
    const result = saleResult({ deviceLabel: 'private-device-label', customFields: { notes: 'private-note', email: 'private@email.test' } });
    vi.mocked(apiRequest).mockResolvedValue(result);
    await createOperation(user, 'sales', { clientName: 'Private Customer', clientId: 'private-client',
      deviceLabel: 'private-device-label', paymentMethod: 'private-payment',
      customFields: { notes: 'private-note', email: 'private@email.test', imei: 'private-imei' },
      unlistedEquipment: { model: 'private-unlisted-model', imei: 'private-imei' } });
    const props = vi.mocked(capture).mock.calls[0][1];
    expect(Object.keys(props!)).toEqual(expect.arrayContaining(['quantity', 'model', 'stock_left', 'sale_id']));
    for (const key of ['clientName', 'clientId', 'imei', 'IMEI', 'notes', 'paymentMethod', 'deviceLabel', 'customFields', 'email']) {
      expect(props).not.toHaveProperty(key);
    }
    expect(JSON.stringify(props)).not.toMatch(/private/i);
  });

  it.each(['create', 'confirm'] as const)('keeps a saved sale successful if analytics assembly fails during %s', async action => {
    const result = { ...saleResult(), get inventory(): Product[] { throw new Error('Bad analytics data'); } };
    vi.mocked(apiRequest).mockResolvedValue(result);
    const saved = action === 'create' ? await createOperation(user, 'sales', {}) : await confirmTradeOperation(user, 'tradeins', 'draft-1', {});
    expect(saved).toBe(result);
    expect(capture).not.toHaveBeenCalled();
  });

  it.each(['create', 'confirm'] as const)('emits nothing if saving fails during %s', async action => {
    const error = new Error('Save failed');
    vi.mocked(apiRequest).mockRejectedValue(error);
    const save = action === 'create' ? createOperation(user, 'sales', {}) : confirmTradeOperation(user, 'tradeins', 'draft-1', {});
    await expect(save).rejects.toBe(error);
    expect(capture).not.toHaveBeenCalled();
  });

  it('emits nothing on sale edit, cancellation or restoration', async () => {
    vi.mocked(apiRequest).mockResolvedValue(saleResult());
    await updateSaleOperation(user, 'sale-1', { amount: 5000 });
    await cancelSaleOperation(user, 'sale-1');
    await restoreSaleOperation(user, 'sale-1');
    expect(capture).not.toHaveBeenCalled();
  });
});
