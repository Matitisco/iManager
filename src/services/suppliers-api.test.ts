import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { fetchSupplier, fetchSupplierPurchase } from './suppliers-api';
vi.mock('./api-client', () => ({ apiRequest: vi.fn() }));
const user = { uid: 'test', email: 'owner@example.test', displayName: 'Owner', getIdToken: async () => 'test-token' };

describe('supplier purchase contracts', () => {
  it('requests the lightweight supplier history without legacy loose devices', async () => {
    const supplier = { id: 'sup', purchases: [{ id: 'buy', name: 'Octubre', devices: 3, costTotals: [{ currency: 'USD', totalCost: 100 }] }] };
    vi.mocked(apiRequest).mockResolvedValueOnce({ supplier });
    expect(await fetchSupplier(user, 'sup')).toEqual(supplier);
    expect(apiRequest).toHaveBeenCalledWith(user, '/api/suppliers/sup?includeItems=0', expect.any(Object));
  });
  it('loads purchase devices from the dedicated endpoint and propagates failures', async () => {
    const purchase = { id: 'buy', items: [{ id: 'eq', problemLabel: 'Reclamo' }] };
    vi.mocked(apiRequest).mockResolvedValueOnce({ purchase });
    expect(await fetchSupplierPurchase(user, 'sup', 'buy')).toEqual(purchase);
    expect(apiRequest).toHaveBeenCalledWith(user, '/api/suppliers/sup/purchases/buy', expect.any(Object));
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('No se pudo abrir la compra'));
    await expect(fetchSupplierPurchase(user, 'sup', 'buy')).rejects.toThrow('No se pudo abrir la compra');
  });
});
