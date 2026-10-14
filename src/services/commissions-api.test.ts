import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from './fetch-with-timeout';
import { assignSalesSeller, createCommissionPayment, createCommissionRule, deleteCommissionRule, fetchCommissionMember,
  fetchCommissionPayments, fetchCommissionReport, fetchCommissionRules, fetchCommissionSummary, fetchMyCommissions, updateCommissionRule } from './commissions-api';

vi.mock('./fetch-with-timeout', () => ({ fetchWithTimeout: vi.fn() }));
const user = { uid: 'u', email: null, displayName: null, getIdToken: vi.fn().mockResolvedValue('token') };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const lastRequest = () => vi.mocked(fetchWithTimeout).mock.calls.at(-1)!;

describe('commissions HTTP client', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = 'https://api.imanager.test';
  });
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__;
  });
  it('uses authenticated summary, member, own and report endpoints with encoded parameters', async () => {
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({}));
    await fetchCommissionSummary(user, '2026-01');
    expect(lastRequest()).toEqual(['https://api.imanager.test/api/commissions?period=2026-01', { method: 'GET', headers: { Authorization: 'Bearer token', Accept: 'application/json' } }]);
    await fetchCommissionMember(user, 'member/1', '2026-01');
    expect(lastRequest()[0]).toContain('/members/member%2F1?period=2026-01');
    await fetchMyCommissions(user);
    expect(lastRequest()[0]).toBe('https://api.imanager.test/api/commissions/mine');
    await fetchCommissionReport(user, '2026-01', '2026-02');
    expect(lastRequest()[0]).toContain('/api/reports/commissions?from=2026-01&to=2026-02');
  });
  it('sends partial cross-currency payments and explicit null bulk sellers unchanged', async () => {
    const payment = { memberId: 'm', period: '2026-01', amount: 12.5, currency: 'USD' as const, exchangeRate: 1250, settlesCurrency: 'ARS' as const, note: 'Parcial' };
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({ payment }));
    await expect(createCommissionPayment(user, payment)).resolves.toEqual(payment);
    expect(lastRequest()[1]).toMatchObject({ method: 'POST', body: JSON.stringify(payment) });
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({ updated: 2 }));
    await expect(assignSalesSeller(user, ['a', 'b'], null)).resolves.toEqual({ updated: 2 });
    expect(lastRequest()[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ saleIds: ['a', 'b'], sellerMemberId: null }) });
  });
  it('supports rule CRUD, partial patch, and list filters', async () => {
    const rule = { memberId: null, rate: 10, effectiveFrom: '2026-01-01' };
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({ rule }));
    await expect(createCommissionRule(user, rule)).resolves.toEqual(rule);
    await updateCommissionRule(user, 'r/1', { rate: 20 });
    expect(lastRequest()[0]).toContain('/rules/r%2F1');
    expect(lastRequest()[1]).toMatchObject({ method: 'PATCH', body: '{"rate":20}' });
    vi.mocked(fetchWithTimeout).mockResolvedValue(new Response(null, { status: 204 }));
    await deleteCommissionRule(user, 'r');
    expect(lastRequest()[1].method).toBe('DELETE');
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({ rules: [rule] }));
    await expect(fetchCommissionRules(user)).resolves.toEqual([rule]);
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({ payments: [] }));
    await expect(fetchCommissionPayments(user, '2026-01', 'm')).resolves.toEqual([]);
    expect(lastRequest()[0]).toContain('/payments?period=2026-01&memberId=m');
  });
  it('surfaces denied writes and malformed persistence responses', async () => {
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({ error: 'No tenés acceso a Comisiones' }, 403));
    await expect(assignSalesSeller(user, ['a'], null)).rejects.toMatchObject({ status: 403 });
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response({}));
    await expect(createCommissionRule(user, { memberId: null, rate: 10, effectiveFrom: '2026-01-01' })).rejects.toThrow('Respuesta inválida');
    await expect(fetchCommissionRules(user)).rejects.toThrow('Respuesta inválida');
  });
});
