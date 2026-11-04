import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AppSession } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import type { ConsignmentList } from '../services/consignments-api';
import { useConsignmentsState } from './consignments-state';
const api = vi.hoisted(() => ({
  fetchConsignments: vi.fn(),
  createConsignments: vi.fn(),
  payConsignment: vi.fn(),
  fetchConsignmentOptions: vi.fn(),
}));
vi.mock('../services/consignments-api', () => api);
vi.mock('../lib/list-sync', () => ({
  useListRefresh: vi.fn(),
  publishListMutation: vi.fn(),
}));
const user = { uid: 'owner' } as AuthUserLike;
const session = (id: string) =>
  ({
    store: { id },
    user: { id: 'owner' },
    membership: { role: 'OWNER' },
    onboardingRequired: false,
  }) as AppSession;
const empty: ConsignmentList = {
  items: [],
  totals: {
    debt: { ARS: 0, USD: 0 },
    equipment: 0,
    people: 0,
    oldestDays: 0,
    oldestClient: null,
  },
};
const row = {
  id: 'entry',
  clientId: 'client',
  clientName: 'Diego',
  phone: null,
  productId: 'device',
  deviceLabel: 'iPhone 15',
  imei: null,
  amount: 100,
  currency: 'ARS' as const,
  cantidad: 1,
  deliveredAt: '2026-11-04T12:00:00Z',
  daysOut: 0,
  paidAt: null,
  saleId: null,
};
const pending = {
  items: [row],
  totals: {
    ...empty.totals,
    debt: { ARS: 100, USD: 0 },
    equipment: 1,
    people: 1,
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  api.fetchConsignments.mockResolvedValue(empty);
});
it('no consulta sin sesión confirmada ni contexto de tienda', async () => {
  const { result } = renderHook(() =>
    useConsignmentsState(user, session('s'), 'ready', false, vi.fn()),
  );
  expect(api.fetchConsignments).not.toHaveBeenCalled();
  await expect(
    result.current.addConsignments({ clientId: 'client', items: [] }),
  ).rejects.toThrow('El backend');
});
it('descarta respuestas viejas incluso al salir y volver a la misma tienda', async () => {
  let resolve!: (data: ConsignmentList) => void;
  api.fetchConsignments.mockImplementationOnce(
    () =>
      new Promise<ConsignmentList>((done) => {
        resolve = done;
      }),
  );
  const { result, rerender } = renderHook(
    ({ store }) =>
      useConsignmentsState(user, session(store), 'ready', true, vi.fn()),
    { initialProps: { store: 's1' } },
  );
  rerender({ store: 's2' });
  await waitFor(() => expect(result.current.consignments).toEqual(empty));
  rerender({ store: 's1' });
  await waitFor(() => expect(api.fetchConsignments).toHaveBeenCalledTimes(3));
  await act(async () => resolve(pending));
  expect(result.current.consignments).toEqual(empty);
});
it('refleja el cobro persistido aunque falle recargar y conserva error visible', async () => {
  api.fetchConsignments
    .mockResolvedValueOnce(pending)
    .mockRejectedValue(new Error('No se pudo recargar'));
  api.payConsignment.mockResolvedValue({
    consignment: { ...row, paidAt: '2026-11-04T15:00:00Z', saleId: 'sale' },
    sale: { id: 'sale' },
  });
  const handler = vi.fn();
  const { result } = renderHook(() =>
    useConsignmentsState(user, session('s1'), 'ready', true, handler),
  );
  await waitFor(() =>
    expect(result.current.consignments?.items).toHaveLength(1),
  );
  await act(async () => {
    await result.current.collectConsignment('entry', 'EFECTIVO');
  });
  expect(result.current.consignments?.items).toHaveLength(0);
  expect(result.current.consignments?.totals.equipment).toBe(0);
  expect(result.current.consignmentsError).toBe('No se pudo recargar');
  expect(handler).toHaveBeenCalledOnce();
});
it('no aplica una mutación resuelta después de cambiar de tienda', async () => {
  let resolve!: (value: { items: (typeof row)[] }) => void;
  api.createConsignments.mockImplementation(
    () =>
      new Promise<{ items: (typeof row)[] }>((done) => {
        resolve = done;
      }),
  );
  const handler = vi.fn();
  const { result, rerender } = renderHook(
    ({ store }) =>
      useConsignmentsState(user, session(store), 'ready', true, handler),
    { initialProps: { store: 's1' } },
  );
  await waitFor(() => expect(result.current.consignments).toEqual(empty));
  let mutation!: Promise<void>;
  act(() => {
    mutation = result.current.addConsignments({
      clientId: 'client',
      items: [{ productId: 'device', amount: 100, currency: 'ARS' }],
    });
  });
  rerender({ store: 's2' });
  await act(async () => {
    resolve({ items: [row] });
    await mutation;
  });
  expect(handler).not.toHaveBeenCalled();
  expect(result.current.consignments?.items).toHaveLength(0);
});
