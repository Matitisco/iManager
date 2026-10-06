import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, CustomColumn, TradeIn, TradeInCategory } from '../types';
import { TradeIns } from './TradeIns';

const mockState = vi.hoisted(() => ({
  appContext: {
    user: { uid: 'user-1', getIdToken: vi.fn() },
    tradeIns: [] as TradeIn[],
    clients: [] as Client[],
    addTradeIn: vi.fn(),
    updateTradeIn: vi.fn(),
    deleteTradeIn: vi.fn(),
    tradeInCategories: [] as TradeInCategory[],
    createTradeInCategory: vi.fn(),
    renameTradeInCategory: vi.fn(),
    deleteTradeInCategory: vi.fn(),
    bulkMoveTradeInCategory: vi.fn(),
    reorderTradeInCategories: vi.fn(),
    customColumns: [] as CustomColumn[],
    addCustomColumn: vi.fn(),
    removeCustomColumn: vi.fn(),
  },
  fetchTradeInsPage: vi.fn(),
  fetchTradeInFilteredIds: vi.fn(),
  invalidateTradeInsCache: vi.fn(),
  updateTradeInCategoryInCache: vi.fn(),
  importBackendTradeIns: vi.fn(),
  latestTableProps: null as null | { config: any; user: unknown; searchTerm?: string },
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockState.appContext,
}));

vi.mock('../components/table-engine', () => ({
  TableEngine: (props: any) => {
    mockState.latestTableProps = props;
    return (
      <div data-testid="tradeins-table-engine">
        <span>{props.config.title}</span>
      </div>
    );
  },
}));

vi.mock('../services/trade-ins-table-api', () => ({
  fetchTradeInsPage: (...args: unknown[]) => mockState.fetchTradeInsPage(...args),
  fetchTradeInFilteredIds: (...args: unknown[]) => mockState.fetchTradeInFilteredIds(...args),
  invalidateTradeInsCache: (...args: unknown[]) => mockState.invalidateTradeInsCache(...args),
  updateTradeInCategoryInCache: (...args: unknown[]) => mockState.updateTradeInCategoryInCache(...args),
}));

vi.mock('../services/trade-ins-import-api', () => ({
  importBackendTradeIns: (...args: unknown[]) => mockState.importBackendTradeIns(...args),
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
    status: 'PENDIENTE',
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
    date: '2026-04-18',
    clientId: 'missing-client',
    categoryId: null,
    deviceReceived: 'Motorola Edge',
    deviceReceivedImei: 'IMEI-003',
    takeValue: 500,
    deviceGiven: 'Pixel 9',
    differencePaid: 300,
    status: 'PENDIENTE',
    batteryHealth: '88%',
    grade: '',
  },
  {
    id: 'trade-4',
    date: '2026-04-17',
    clientId: 'client-2',
    categoryId: null,
    deviceReceived: 'Nokia G50',
    deviceReceivedImei: 'IMEI-004',
    takeValue: 700,
    deviceGiven: 'Moto G85',
    differencePaid: 100,
    status: 'APROBADO',
    batteryHealth: '80%',
    grade: 'C',
  },
];

const tradeInCategories: TradeInCategory[] = [
  { id: 'cat-a', name: 'Pendientes' },
  { id: 'cat-b', name: 'Listos' },
];

const customColumns: CustomColumn[] = [
  { id: 'custom-text', label: 'Observaciones', type: 'text', entity: 'trade-ins' },
  { id: 'custom-number', label: 'Score', type: 'number', entity: 'trade-ins' },
  { id: 'inventory-only', label: 'No aplica', type: 'text', entity: 'inventory' },
];

function resetMocks() {
  mockState.appContext.tradeIns = [...tradeIns];
  mockState.appContext.clients = [...clients];
  mockState.appContext.tradeInCategories = [...tradeInCategories];
  mockState.appContext.customColumns = [...customColumns];
  mockState.appContext.addTradeIn.mockReset();
  mockState.appContext.addTradeIn.mockResolvedValue(undefined);
  mockState.appContext.updateTradeIn.mockReset();
  mockState.appContext.updateTradeIn.mockResolvedValue(undefined);
  mockState.appContext.deleteTradeIn.mockReset();
  mockState.appContext.deleteTradeIn.mockResolvedValue(undefined);
  mockState.appContext.createTradeInCategory.mockReset();
  mockState.appContext.createTradeInCategory.mockResolvedValue({ id: 'cat-new', name: 'Nuevos' });
  mockState.appContext.renameTradeInCategory.mockReset();
  mockState.appContext.renameTradeInCategory.mockResolvedValue(undefined);
  mockState.appContext.deleteTradeInCategory.mockReset();
  mockState.appContext.deleteTradeInCategory.mockResolvedValue(undefined);
  mockState.appContext.bulkMoveTradeInCategory.mockReset();
  mockState.appContext.bulkMoveTradeInCategory.mockResolvedValue(undefined);
  mockState.appContext.reorderTradeInCategories.mockReset();
  mockState.appContext.reorderTradeInCategories.mockResolvedValue(undefined);
  mockState.appContext.addCustomColumn.mockReset();
  mockState.appContext.addCustomColumn.mockResolvedValue('custom-created');
  mockState.appContext.removeCustomColumn.mockReset();
  mockState.appContext.removeCustomColumn.mockResolvedValue(undefined);
  mockState.fetchTradeInsPage.mockReset();
  mockState.fetchTradeInsPage.mockResolvedValue({ items: tradeIns.slice(0, 2), total: tradeIns.length });
  mockState.fetchTradeInFilteredIds.mockReset();
  mockState.fetchTradeInFilteredIds.mockResolvedValue(['trade-1', 'trade-2']);
  mockState.invalidateTradeInsCache.mockReset();
  mockState.updateTradeInCategoryInCache.mockReset();
  mockState.importBackendTradeIns.mockReset();
  mockState.importBackendTradeIns.mockResolvedValue({ imported: 1, updated: 0, errors: [] });
  mockState.latestTableProps = null;
}

describe('TradeIns', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('renders KPIs and the trade-ins table', () => {
    render(<TradeIns searchTerm="galaxy" />);

    expect(screen.queryByText('Canjes recientes')).not.toBeInTheDocument();
    expect(screen.getByText('4 totales')).toBeInTheDocument();
    expect(screen.getByText('1 aprobados')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText(/\$\s*2\.400/)).toBeInTheDocument();
    expect(screen.getByText(/\$\s*400/)).toBeInTheDocument();
    expect(screen.getByText('Historial de Canjes')).toBeInTheDocument();
    expect(screen.getByTestId('tradeins-table-engine')).toBeInTheDocument();
    expect(mockState.latestTableProps?.searchTerm).toBe('galaxy');
    expect(mockState.latestTableProps?.user).toBe(mockState.appContext.user);
  });

  it('wires TableEngine callbacks for filters, categories, custom columns, create, import and bulk actions', async () => {
    render(<TradeIns />);

    const config = mockState.latestTableProps?.config;
    expect(config).toBeTruthy();
    expect(config.filters.map((filter: { id: string }) => filter.id)).toEqual([
      'date',
      'clientId',
      'deviceReceived',
      'status',
    ]);
    expect(config.dynamicColumns.columns.map((column: { id: string }) => column.id)).toEqual([
      'custom-text',
      'custom-number',
    ]);

    await config.fetchPage({
      skip: 0,
      take: 30,
      search: 'Sofia',
      filters: { status: 'PENDIENTE' },
    });
    expect(mockState.fetchTradeInsPage).toHaveBeenCalledWith(
      mockState.appContext.user,
      {
        skip: 0,
        take: 30,
        search: 'Sofia',
        filters: { status: 'PENDIENTE' },
      },
      mockState.appContext.clients,
    );

    await config.fetchFilteredIds({
      search: 'Galaxy',
      categoryId: 'cat-b',
      filters: { status: 'PENDIENTE' },
    });
    expect(mockState.fetchTradeInFilteredIds).toHaveBeenCalledWith(
      mockState.appContext.user,
      {
        search: 'Galaxy',
        categoryId: 'cat-b',
        filters: { status: 'PENDIENTE' },
      },
      mockState.appContext.clients,
    );

    const builtTradeIn = config.buildNewItem(
      {
        clientId: 'client-1',
        date: '',
        deviceReceived: 'Moto G',
        deviceReceivedImei: 'IMEI-NEW',
        takeValue: '650',
        deviceGiven: 'iPhone 15',
        differencePaid: '400',
        batteryHealth: '85%',
        grade: 'B',
        status: 'LISTO',
        'dynamic:custom-text': 'Detalle',
        'dynamic:custom-number': '42',
      },
      'cat-b',
    );

    expect(builtTradeIn).toMatchObject({
      clientId: 'client-1',
      categoryId: 'cat-b',
      deviceReceived: 'Moto G',
      deviceReceivedImei: 'IMEI-NEW',
      takeValue: 650,
      deviceGiven: 'iPhone 15',
      differencePaid: 400,
      status: 'LISTO',
      batteryHealth: '85%',
      grade: 'B',
      customFields: {
        'custom-text': 'Detalle',
        'custom-number': 42,
      },
    });
    expect(builtTradeIn.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await config.onCreate(builtTradeIn);
    expect(mockState.appContext.addTradeIn).toHaveBeenCalledWith(builtTradeIn);
    expect(mockState.invalidateTradeInsCache).toHaveBeenCalledTimes(1);

    await config.onBulkMoveCategory(['trade-1'], 'cat-b');
    expect(mockState.appContext.bulkMoveTradeInCategory).toHaveBeenCalledWith(['trade-1'], 'cat-b');
    expect(mockState.updateTradeInCategoryInCache).toHaveBeenCalledWith(['trade-1'], 'cat-b');

    await config.onBulkDelete(['trade-1', 'trade-2']);
    await waitFor(() => {
      expect(mockState.appContext.deleteTradeIn).toHaveBeenCalledTimes(2);
    });

    await config.customColumnActions.onCreate({ label: 'Estado interno', type: 'text' });
    expect(mockState.appContext.addCustomColumn).toHaveBeenCalledWith({
      label: 'Estado interno',
      type: 'text',
      entity: 'trade-ins',
    });

    await config.customColumnActions.onDelete('dynamic:custom-text');
    expect(mockState.appContext.removeCustomColumn).toHaveBeenCalledWith('custom-text');

    expect(config.importConfig.title).toBe('Importar canjes');
    expect(config.importConfig.fields.map((field: { key: string }) => field.key)).toEqual([
      'clientName',
      'date',
      'deviceReceived',
      'deviceReceivedImei',
      'takeValue',
      'deviceGiven',
      'differencePaid',
      'status',
      'batteryHealth',
      'grade',
    ]);

    await config.importConfig.onImport([
      {
        clientName: 'Ana Torres',
        deviceReceived: 'Moto G',
        deviceReceivedImei: 'IMEI-NEW',
        takeValue: '650',
        deviceGiven: 'iPhone 15',
        differencePaid: '400',
      },
    ]);
    expect(mockState.importBackendTradeIns).toHaveBeenCalledWith(mockState.appContext.user, [
      {
        clientName: 'Ana Torres',
        deviceReceived: 'Moto G',
        deviceReceivedImei: 'IMEI-NEW',
        takeValue: '650',
        deviceGiven: 'iPhone 15',
        differencePaid: '400',
      },
    ]);
  });

  it('persists trade-in updates and deletes through the table config', async () => {
    render(<TradeIns />);

    const config = mockState.latestTableProps?.config;
    await config.onUpdate(tradeIns[0]);
    expect(mockState.appContext.updateTradeIn).toHaveBeenCalledWith(tradeIns[0]);
    expect(mockState.invalidateTradeInsCache).toHaveBeenCalledTimes(1);

    await config.onDelete('trade-1');
    expect(mockState.appContext.deleteTradeIn).toHaveBeenCalledWith('trade-1');
    expect(mockState.invalidateTradeInsCache).toHaveBeenCalledTimes(2);
  });
});
