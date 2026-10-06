import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, TradeIn } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import {
  clearTradeInCategoryInCache,
  fetchTradeInFilteredIds,
  fetchTradeInsPage,
  invalidateTradeInsCache,
  updateTradeInCategoryInCache,
} from './trade-ins-table-api';
import { fetchBackendTradeIns } from './trade-ins-api';

vi.mock('./trade-ins-api', () => ({
  fetchBackendTradeIns: vi.fn(),
}));

const clients: Client[] = [
  {
    id: 'client-1',
    dni: '11222333',
    name: 'Ana Torres',
    email: 'ana@imanager.test',
    phone: '2614000001',
    lastPurchaseDate: '2026-04-20',
    totalSpent: 1500,
    pendingBalance: 0,
  },
  {
    id: 'client-2',
    dni: '22333444',
    name: 'Sofia Gomez',
    email: 'sofia@imanager.test',
    phone: '2614000002',
    lastPurchaseDate: '2026-04-18',
    totalSpent: 2200,
    pendingBalance: 100,
  },
];

const tradeIns: TradeIn[] = [
  {
    id: 'trade-1',
    date: '2026-04-20',
    clientId: 'client-1',
    categoryId: 'cat-a',
    deviceReceived: 'iPhone 13',
    deviceReceivedImei: 'IMEI-001',
    takeValue: 300,
    deviceGiven: 'iPhone 15',
    differencePaid: 800,
    status: 'APROBADO',
    batteryHealth: '91%',
    grade: 'A',
  },
  {
    id: 'trade-2',
    date: '2026-04-19',
    clientId: 'client-2',
    categoryId: 'cat-b',
    deviceReceived: 'Galaxy S24',
    deviceReceivedImei: 'IMEI-002',
    takeValue: 900,
    deviceGiven: 'iPhone 16',
    differencePaid: 400,
    status: 'PENDIENTE',
    batteryHealth: '84%',
    grade: 'B',
  },
  {
    id: 'trade-3',
    date: '2026-04-20',
    clientId: 'client-2',
    categoryId: null,
    deviceReceived: 'Motorola Edge',
    deviceReceivedImei: 'IMEI-003',
    takeValue: 500,
    deviceGiven: 'Pixel 9',
    differencePaid: 300,
    status: 'LISTO',
    batteryHealth: '88%',
    grade: 'A-',
  },
];

function buildUser(uid: string): AuthUserLike {
  return {
    uid,
    email: `${uid}@imanager.test`,
    displayName: uid,
    getIdToken: vi.fn().mockResolvedValue(`token-${uid}`),
  };
}

const userA = buildUser('user-a');
const userB = buildUser('user-b');

describe('trade-ins-table-api', () => {
  beforeEach(() => {
    invalidateTradeInsCache();
    vi.mocked(fetchBackendTradeIns).mockReset();
    vi.mocked(fetchBackendTradeIns).mockResolvedValue(tradeIns);
  });

  it('reuses the cache for the same user and refetches after invalidation', async () => {
    await fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);
    await fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);
    await fetchTradeInsPage(userB, { skip: 0, take: 10, filters: {} }, clients);

    expect(fetchBackendTradeIns).toHaveBeenCalledTimes(2);
    expect(fetchBackendTradeIns).toHaveBeenNthCalledWith(1, userA);
    expect(fetchBackendTradeIns).toHaveBeenNthCalledWith(2, userB);

    invalidateTradeInsCache();
    await fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);

    expect(fetchBackendTradeIns).toHaveBeenCalledTimes(3);
  });

  it('filters by search term using trade-in fields and linked client data', async () => {
    const byClientName = await fetchTradeInsPage(
      userA,
      {
        skip: 0,
        take: 10,
        search: 'sofia',
        filters: {},
      },
      clients,
    );

    const byClientDni = await fetchTradeInsPage(
      userA,
      {
        skip: 0,
        take: 10,
        search: '22333444',
        filters: {},
      },
      clients,
    );

    expect(byClientName.items.map((item) => item.id)).toEqual(['trade-3', 'trade-2']);
    expect(byClientDni.items.map((item) => item.id)).toEqual(['trade-3', 'trade-2']);
  });

  it('applies category and discrete filters before sorting', async () => {
    const response = await fetchTradeInsPage(
      userA,
      {
        skip: 0,
        take: 10,
        categoryId: 'cat-b',
        sortKey: 'takeValue',
        sortDir: 'desc',
        filters: {
          date: '2026-04-19',
          clientId: 'client-2',
          deviceReceived: 'Galaxy S24',
          status: 'PENDIENTE',
        },
      },
      clients,
    );

    expect(response.total).toBe(1);
    expect(response.items).toEqual([tradeIns[1]]);
  });

  it('sorts numeric and text fields using the requested direction', async () => {
    const byValue = await fetchTradeInsPage(
      userA,
      {
        skip: 0,
        take: 10,
        sortKey: 'takeValue',
        sortDir: 'asc',
        filters: {},
      },
      clients,
    );

    const byDevice = await fetchTradeInsPage(
      userA,
      {
        skip: 0,
        take: 10,
        sortKey: 'deviceReceived',
        sortDir: 'asc',
        filters: {},
      },
      clients,
    );

    expect(byValue.items.map((item) => item.id)).toEqual(['trade-1', 'trade-3', 'trade-2']);
    expect(byDevice.items.map((item) => item.id)).toEqual(['trade-2', 'trade-1', 'trade-3']);
  });

  it('returns filtered ids in default order, ignoring explicit sort hints', async () => {
    const ids = await fetchTradeInFilteredIds(
      userA,
      {
        search: 'client',
        categoryId: undefined,
        filters: {},
      },
      [],
    );

    expect(ids).toEqual([]);

    const allIds = await fetchTradeInFilteredIds(
      userA,
      {
        search: 'IMEI',
        categoryId: undefined,
        filters: {},
      },
      clients,
    );

    expect(allIds).toEqual(['trade-3', 'trade-1', 'trade-2']);
  });

  it('updates cached categories so later reads reflect bulk moves', async () => {
    await fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);

    updateTradeInCategoryInCache(['trade-1', 'trade-3'], 'cat-z');

    const movedItems = await fetchTradeInsPage(
      userA,
      {
        skip: 0,
        take: 10,
        categoryId: 'cat-z',
        filters: {},
      },
      clients,
    );

    expect(movedItems.items.map((item) => item.id)).toEqual(['trade-3', 'trade-1']);
  });

  it('drops a deleted category from the cached list without another request', async () => {
    await fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);
    clearTradeInCategoryInCache('cat-a');

    const stillInCategory = await fetchTradeInsPage(
      userA,
      { skip: 0, take: 10, categoryId: 'cat-a', filters: {} },
      clients,
    );
    const all = await fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);

    expect(fetchBackendTradeIns).toHaveBeenCalledTimes(1);
    expect(stillInCategory.items).toEqual([]);
    expect(all.items.find((item) => item.id === 'trade-1')?.categoryId).toBeNull();
  });

  it('ignores a stale list that arrives after the cache was invalidated', async () => {
    const kept = tradeIns.filter((tradeIn) => tradeIn.id !== 'trade-1');
    let resolveStale: (rows: TradeIn[]) => void = () => {};
    vi.mocked(fetchBackendTradeIns).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveStale = resolve;
      }),
    );

    const pending = fetchTradeInsPage(userA, { skip: 0, take: 10, filters: {} }, clients);
    invalidateTradeInsCache();
    vi.mocked(fetchBackendTradeIns).mockResolvedValue(kept);
    resolveStale(tradeIns);

    const page = await pending;
    expect(page.items.map((tradeIn) => tradeIn.id)).toEqual(['trade-3', 'trade-2']);
    expect(fetchBackendTradeIns).toHaveBeenCalledTimes(2);
  });
});
