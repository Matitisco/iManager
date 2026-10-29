import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockOnboarding } from './StockOnboarding';
import { ImportHost } from '../desk/overlays/import';
import { DeskProvider } from '../desk/ui';
import type { ImportAnalysis } from '../services/import-api';

const mocks = vi.hoisted(() => ({
  analyzeImport: vi.fn(), applyImportPlan: vi.fn(), analyzeInventoryText: vi.fn(),
  analyzeInventoryTextProgress: vi.fn(), importBackendRows: vi.fn(),
  fetchBackendInventory: vi.fn(), fetchArchivedInventory: vi.fn(),
}));
const context = vi.hoisted(() => ({
  user: { uid: 'qa' }, inventory: [],
  appSession: { store: { name: 'Tienda ficticia', onboardingStartedAt: '2026-10-29' }, membership: { role: 'OWNER' } },
  customFieldDefinitions: [{ id: 'origen', entity: 'inventory', key: 'origen', label: 'Origen QA', type: 'text', order: 0 }],
  customFieldDefinitionsError: null as string | null,
  reloadInventory: vi.fn(async () => undefined), reloadCustomFieldDefinitions: vi.fn(async () => undefined),
  refreshGettingStarted: vi.fn(async () => undefined), finishStockOnboarding: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../services/import-api', () => mocks);
vi.mock('../services/inventory-api', () => mocks);
vi.mock('../desk/exchange', () => ({ ExchangeProvider: ({ children }: { children: React.ReactNode }) => children, exchangeFromStore: () => ({}), useMoney: () => ({ rate: 1300 }) }));
vi.mock('../desk/DeskOverlays', () => ({ DeskOverlays: () => null }));
vi.mock('../lib/analytics', () => ({ track: vi.fn(), rowBucket: (n: number) => String(n) }));
vi.mock('../lib/posthog-analytics', () => ({ capture: vi.fn() }));

const sheets = [{ name: 'Hoja 1', rows: [
  ['Modelo', 'IMEI', 'Precio USD', 'Origen QA'],
  ['Equipo ficticio', '990000000000038', '420', 'Ficticio'],
  ['', '990000000000038', '', 'Duplicado ficticio'],
  ['', '', '', ''],
  ['Equipo sin precio', '', '', ''],
] }];
const rows = [
  { model: 'Equipo ficticio', imei: '990000000000038', price: '420', currency: 'USD', quantity: '1', _sourceRow: '2', _sourceSheet: 'Hoja 1', 'custom:origen': 'Ficticio' },
  { model: 'Equipo sin modelo', imei: '', price: '', quantity: '1', status: 'EN_REVISION', batteryNote: 'IMEI duplicado en el archivo: 990000000000038', _sourceRow: '3', _sourceSheet: 'Hoja 1' },
  { model: 'Equipo sin precio', imei: '', price: '', quantity: '1', _sourceRow: '5', _sourceSheet: 'Hoja 1' },
];
function analysis(): ImportAnalysis {
  return { source: 'model', notice: null, currency: 'USD', rows, plan: [{ name: 'Hoja 1', include: true, condition: '', headerRow: 1, dataStartRow: 2, dataEndRow: 5, mapping: [
    { header: 'Modelo', columnIndex: 0, field: 'model', review: ['Verificar modelo'] },
    { header: 'IMEI', columnIndex: 1, field: 'imei' },
    { header: 'Precio USD', columnIndex: 2, field: 'price' },
    { header: 'Origen QA', columnIndex: 3, field: 'custom:origen' },
  ], splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD' }], summary: { sheetCount: 1, rowCount: 3, sheets: [{ name: 'Hoja 1', included: true, condition: '', rows: 3 }] } };
}
beforeEach(() => {
  vi.clearAllMocks();
  context.customFieldDefinitionsError = null;
  context.reloadInventory.mockResolvedValue(undefined);
  mocks.analyzeImport.mockResolvedValue(analysis());
  mocks.applyImportPlan.mockImplementation(async (_user, _section, _sheets, plan) => ({ ...analysis(), plan }));
  mocks.importBackendRows.mockResolvedValue({ imported: 3, updated: 0, errors: [] });
  mocks.fetchBackendInventory.mockResolvedValue([{ imei: '990000000000038', status: 'VENDIDO' }]);
  mocks.fetchArchivedInventory.mockResolvedValue([]);
});
async function upload() {
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File([sheets[0].rows.map(row => row.join(',')).join('\n')], 'stock-falso.csv', { type: 'text/csv' }));
  await screen.findByTestId('import-preview-count');
}
function onboarding() {
  const onFinish = vi.fn();
  render(<StockOnboarding onFinish={onFinish} />);
  fireEvent.click(screen.getByRole('button', { name: 'Subir Excel' }));
  return onFinish;
}

describe('onboarding con el importador real de Inventario', () => {
  it.each(['onboarding', 'inventory'])('%s comparte análisis, selector por encabezado, reaplicación, campos y payload', async entry => {
    const finish = entry === 'onboarding' ? onboarding() : vi.fn();
    if (entry === 'inventory') render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><ImportHost kind="inv" /></DeskProvider>);
    await upload();
    expect(mocks.analyzeImport).toHaveBeenCalledWith(context.user, 'inventory', sheets);
    expect(mocks.fetchBackendInventory).toHaveBeenCalledWith(context.user);
    expect(mocks.fetchArchivedInventory).toHaveBeenCalledWith(context.user);
    expect(mocks.importBackendRows).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-preview-count')).toHaveTextContent('3 equipos');
    expect(screen.getByTestId('import-imei-warning')).toHaveTextContent('1 actualización por IMEI');
    expect(screen.queryByTestId('import-adjust')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Importar Modelo como' }));
    const picker = screen.getByRole('dialog', { name: /Importar A · Modelo como/ });
    for (const field of ['Calidad', 'Estado', 'Fecha de ingreso', 'Detalle batería', 'Proveedor', 'Origen QA']) {
      expect(within(picker).getByRole('button', { name: new RegExp(`^${field}(?:$| )`) })).toBeInTheDocument();
    }
    await userEvent.click(within(picker).getByRole('button', { name: 'Modelo' }));
    await waitFor(() => expect(mocks.applyImportPlan).toHaveBeenCalledWith(context.user, 'inventory', sheets, expect.any(Array), false));
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(mocks.importBackendRows).toHaveBeenCalledOnce());
    expect(mocks.importBackendRows.mock.calls[0]).toEqual([context.user, 'inventory', [
      expect.objectContaining({ model: 'Equipo ficticio', sourceRow: 2, customFields: { origen: 'Ficticio' } }),
      expect.objectContaining({ model: 'Equipo sin modelo', sourceRow: 3, status: 'EN_REVISION', batteryNote: expect.stringContaining('IMEI duplicado') }),
      expect.objectContaining({ model: 'Equipo sin precio', sourceRow: 5 }),
    ], undefined, 'excel']);
    if (entry === 'onboarding') {
      await waitFor(() => expect(finish).toHaveBeenCalledWith('inventory'));
      expect(context.finishStockOnboarding).toHaveBeenCalledWith('import');
    }
  });

  it('vuelve al paso de stock al cancelar sin completar onboarding', async () => {
    const finish = onboarding();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('heading', { name: 'Cargá tu stock' })).toBeVisible();
    expect(finish).not.toHaveBeenCalled();
    expect(context.finishStockOnboarding).not.toHaveBeenCalled();
  });

  it.each(['request', 'rows'])('conserva el onboarding cuando falla la persistencia: %s', async failure => {
    const finish = onboarding();
    if (failure === 'request') mocks.importBackendRows.mockRejectedValueOnce(new Error('No se pudo guardar'));
    else mocks.importBackendRows.mockResolvedValueOnce({ imported: 0, updated: 0, errors: [{ row: 1, message: 'No se pudo guardar' }] });
    await upload();
    await userEvent.click(screen.getByTestId('import-confirm'));
    await screen.findByText('No se pudo guardar');
    expect(finish).not.toHaveBeenCalled();
    expect(context.finishStockOnboarding).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Importar equipos' })).toBeVisible();
  });

  it('no repite escrituras si falla una recarga posterior al guardado', async () => {
    const finish = onboarding();
    context.reloadInventory.mockRejectedValueOnce(new Error('offline'));
    await upload();
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('inventory'));
    expect(mocks.importBackendRows).toHaveBeenCalledOnce();
  });

  it('no confirma si no se pudieron consultar las definiciones existentes', async () => {
    context.customFieldDefinitionsError = 'No se pudieron cargar los campos';
    onboarding();
    await upload();
    expect(screen.getByTestId('import-confirm')).toBeDisabled();
    expect(mocks.importBackendRows).not.toHaveBeenCalled();
  });

  it('no ofrece preview si falla la consulta de IMEI archivados', async () => {
    mocks.fetchArchivedInventory.mockRejectedValueOnce(new Error('No se pudo consultar el archivo'));
    onboarding();
    await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Modelo,Precio\nEquipo QA,420'], 'stock-falso.csv', { type: 'text/csv' }));
    expect(await screen.findByText('No se pudo consultar el archivo')).toBeVisible();
    expect(screen.queryByTestId('import-preview-count')).not.toBeInTheDocument();
    expect(mocks.importBackendRows).not.toHaveBeenCalled();
  });
});
