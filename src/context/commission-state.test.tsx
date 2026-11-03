import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AppSession } from '../types/app-session';
import type { CommissionSeller } from '../types/commissions';
import { commissionFixtureDetail, commissionFixtureSummary } from '../test/commission-fixtures';
import * as api from '../services/commissions-api';
import { useCommissionState } from './commission-state';

vi.mock('../services/commissions-api', () => ({ fetchCommissionSummary: vi.fn(), fetchCommissionRules: vi.fn(), fetchCommissionMember: vi.fn(), saveStoreReseller: vi.fn(), fetchCommissionSellers: vi.fn() }));
const user = { uid: 'fake-owner', email: null, displayName: null, getIdToken: vi.fn(async () => 'fake-token') };
function session(id = 'fake-store'): AppSession {
  return { user: { id: 'fake-user', firebaseUid: user.uid, email: null, displayName: null, avatarUrl: null }, store: { id, name: 'Tienda falsa', legalName: null, taxId: null, phone: null, email: null, instagram: null, address: null, currency: 'USD', timezone: 'America/Argentina/Buenos_Aires' }, membership: { role: 'OWNER', isDefault: true }, onboardingRequired: false };
}
const person = { ...commissionFixtureDetail.person, memberId: null, resellerId: 'reseller', name: 'Diego Ejemplo', role: 'RESELLER' as const };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchCommissionRules).mockResolvedValue([]);
  vi.mocked(api.fetchCommissionSummary).mockResolvedValue({ ...commissionFixtureSummary, people: [person] });
  vi.mocked(api.fetchCommissionMember).mockResolvedValue({ ...commissionFixtureDetail, person });
  vi.mocked(api.saveStoreReseller).mockResolvedValue({ id: 'reseller', name: 'Nombre nuevo', archivedAt: null });
});

it('renombra sin vaciar los saldos ni el detalle cargados', async () => {
  const { result } = renderHook(() => useCommissionState(user, session(), 'ready', true));
  await act(async () => { await result.current.loadCommissions('2026-10'); await result.current.loadCommissionDetail('reseller:reseller', '2026-10'); });
  await act(async () => { await result.current.saveReseller({ name: 'Nombre nuevo' }, 'reseller'); });
  expect(result.current.commissionSummaries['2026-10'].people[0]).toEqual({ ...person, name: 'Nombre nuevo' });
  expect(result.current.commissionDetails['reseller:reseller:2026-10'].person).toEqual({ ...person, name: 'Nombre nuevo' });
  expect(api.fetchCommissionSummary).toHaveBeenCalledTimes(1);
});
it('el alta rápida conserva las comisiones ya visibles', async () => {
  vi.mocked(api.saveStoreReseller).mockResolvedValue({ id: 'new', name: 'Nueva Ejemplo', archivedAt: null });
  const { result } = renderHook(() => useCommissionState(user, session(), 'ready', true));
  await act(async () => { await result.current.loadCommissions('2026-10'); });
  const summary = result.current.commissionSummaries['2026-10'];
  await act(async () => { await result.current.saveReseller({ name: 'Nueva Ejemplo' }); });
  expect(result.current.commissionSummaries['2026-10']).toEqual(summary);
  expect(result.current.commissionSellers).toEqual([expect.objectContaining({ id: 'reseller:new', name: 'Nueva Ejemplo' })]);
});
it('una lectura atrasada no elimina el revendedor recién guardado', async () => {
  let finish!: (people: CommissionSeller[]) => void;
  vi.mocked(api.fetchCommissionSellers).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useCommissionState(user, session(), 'ready', true));
  let loading!: Promise<void>;
  act(() => { loading = result.current.loadCommissionSellers(); });
  await act(async () => { await result.current.saveReseller({ name: 'Nombre nuevo' }); });
  await act(async () => { finish([]); await loading; });
  expect(result.current.commissionSellers).toEqual([expect.objectContaining({ id: 'reseller:reseller', name: 'Nombre nuevo' })]);
});
it('ignora una respuesta de guardado al cambiar de tienda', async () => {
  let finish!: (row: { id: string; name: string; archivedAt: null }) => void;
  vi.mocked(api.saveStoreReseller).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result, rerender } = renderHook(({ id }) => useCommissionState(user, session(id), 'ready', true), { initialProps: { id: 'store-a' } });
  let saving!: ReturnType<typeof result.current.saveReseller>;
  act(() => { saving = result.current.saveReseller({ name: 'De tienda A' }); });
  rerender({ id: 'store-b' });
  await act(async () => { finish({ id: 'old', name: 'De tienda A', archivedAt: null }); await saving; });
  expect(result.current.commissionSellers).toEqual([]);
});
