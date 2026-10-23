import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSectionViewsState } from './section-views-state';
import { fetchSectionChanges, markSectionViewed, type RecordVersion } from '../services/section-views-api';
import type { AppSession } from '../types/app-session';

vi.mock('../services/section-views-api', () => ({ fetchSectionChanges: vi.fn(), markSectionViewed: vi.fn() }));
const user = { uid: 'u', email: null, displayName: null, getIdToken: vi.fn(async () => 'token') };
const session = { store: { id: 's' }, membership: { role: 'OWNER', sections: null } } as AppSession;
const a = { id: 'a', updatedAt: '2026-10-01T12:00:00.000Z' };
const b = { id: 'b', updatedAt: '2026-10-01T12:00:00.000Z' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSectionChanges).mockResolvedValue({ sections: { clients: [a, b], tradeins: [b] } });
  vi.mocked(markSectionViewed).mockImplementation(async (_user, _section, versions) => ({ viewed: versions }));
});

describe('section view state', () => {
  it('logs a warning when loading section changes fails', async () => {
    const error = new Error('No se pudieron cargar las novedades.');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetchSectionChanges).mockRejectedValueOnce(error);
    try {
      const { result } = renderHook(() => useSectionViewsState(user, session, 'ready', []));
      await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar las novedades.', error));
      expect(result.current.sectionChangesError).toBeTruthy();
    } finally {
      warn.mockRestore();
    }
  });

  it('acknowledges only observed versions, preserving other sections and later edits', async () => {
    const { result } = renderHook(() => useSectionViewsState(user, session, 'ready', []));
    await waitFor(() => expect(result.current.sectionChanges.clients).toHaveLength(2));
    const next = { ...a, updatedAt: '2026-10-02T12:00:00.000Z' };
    vi.mocked(fetchSectionChanges).mockResolvedValueOnce({ sections: { clients: [next, b], tradeins: [b] } });
    await act(() => result.current.refreshSectionChanges());
    await act(() => result.current.viewSection('clients', [a]));
    expect(result.current.sectionChanges.clients).toEqual([next, b]);
    expect(result.current.sectionChanges.tradeins).toEqual([b]);
    await act(() => result.current.viewSection('clients', [next, b]));
    expect(result.current.sectionChanges.clients).toEqual([]);
  });

  it('discards an in-flight GET when acknowledging a visit', async () => {
    const { result } = renderHook(() => useSectionViewsState(user, session, 'ready', []));
    await waitFor(() => expect(result.current.sectionChanges.clients).toHaveLength(2));
    const stale = deferred<Awaited<ReturnType<typeof fetchSectionChanges>>>();
    vi.mocked(fetchSectionChanges).mockReturnValueOnce(stale.promise);
    let refreshing!: Promise<void>;
    act(() => { refreshing = result.current.refreshSectionChanges(); });
    await act(() => result.current.viewSection('clients', [a, b]));
    await act(async () => { stale.resolve({ sections: { clients: [a, b] } }); await refreshing; });
    expect(result.current.sectionChanges.clients).toEqual([]);
  });

  it('keeps pending counts and exposes failures, and can retry', async () => {
    const { result } = renderHook(() => useSectionViewsState(user, session, 'ready', []));
    await waitFor(() => expect(result.current.sectionChanges.clients).toHaveLength(2));
    vi.mocked(markSectionViewed).mockRejectedValueOnce(new Error('No se pudieron guardar las novedades vistas.'));
    await act(async () => { await expect(result.current.viewSection('clients', [a, b])).rejects.toThrow(); });
    expect(result.current.sectionChanges.clients).toHaveLength(2);
    expect(result.current.sectionChangesError).toBeTruthy();
    await act(() => result.current.viewSection('clients', [a, b]));
    expect(result.current.sectionChanges.clients).toEqual([]);
    expect(result.current.sectionChangesError).toBe('');
  });

  it('isolates old requests and receipts when switching user, store or permissions', async () => {
    const receipt = deferred<{ viewed: RecordVersion[] }>();
    const { result, rerender } = renderHook(({ currentUser, currentSession }) => useSectionViewsState(currentUser, currentSession, 'ready', []), {
      initialProps: { currentUser: user, currentSession: session },
    });
    await waitFor(() => expect(result.current.sectionChanges.clients).toHaveLength(2));
    vi.mocked(markSectionViewed).mockReturnValueOnce(receipt.promise);
    let saving!: Promise<void>;
    act(() => { saving = result.current.viewSection('clients', [a, b]); });
    vi.mocked(fetchSectionChanges).mockResolvedValueOnce({ sections: { clients: [b] } });
    rerender({ currentUser: { ...user, uid: 'other' }, currentSession: { ...session, store: { ...session.store!, id: 'other-store' }, membership: { ...session.membership!, sections: ['clients'] } } });
    expect(result.current.sectionChanges).toEqual({});
    await waitFor(() => expect(result.current.sectionChanges.clients).toEqual([b]));
    await act(async () => { receipt.resolve({ viewed: [a, b] }); await saving; });
    expect(result.current.sectionChanges.clients).toEqual([b]);
  });

  it('chunks large visits and stops after an error without hiding unacknowledged rows', async () => {
    const versions = Array.from({ length: 2001 }, (_, i) => ({ ...a, id: String(i) }));
    vi.mocked(fetchSectionChanges).mockResolvedValueOnce({ sections: { inventory: versions } });
    const { result } = renderHook(() => useSectionViewsState(user, session, 'ready', []));
    await waitFor(() => expect(result.current.sectionChanges.inventory).toHaveLength(2001));
    vi.mocked(markSectionViewed).mockResolvedValueOnce({ viewed: versions.slice(0, 1000) }).mockRejectedValueOnce(new Error('No se pudo guardar.'));
    await act(async () => { await expect(result.current.viewSection('inventory', versions)).rejects.toThrow(); });
    expect(markSectionViewed).toHaveBeenCalledTimes(2);
    expect(result.current.sectionChanges.inventory).toHaveLength(1001);
  });
});

it('preserves counter references on identical polls and same-uid auth callbacks', async () => {
  vi.mocked(fetchSectionChanges).mockImplementation(async () => ({ sections: { clients: [{ ...a }] } }));
  const { result, rerender } = renderHook(({ identity }) => useSectionViewsState(identity, session, 'ready', []), { initialProps: { identity: user } });
  await waitFor(() => expect(result.current.sectionChanges.clients).toHaveLength(1));
  const before = result.current.sectionChanges;
  rerender({ identity: { ...user } });
  expect(fetchSectionChanges).toHaveBeenCalledTimes(1);
  await act(() => result.current.refreshSectionChanges());
  expect(result.current.sectionChanges).toBe(before);
});
