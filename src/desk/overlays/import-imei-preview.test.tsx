import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { ImportHost } from './import';
const mocks = vi.hoisted(() => ({ analyzeImport: vi.fn(), fetchBackendInventory: vi.fn(), fetchArchivedInventory: vi.fn(), importBackendRows: vi.fn() }));
vi.mock('../../services/inventory-api', () => mocks);
vi.mock('../../services/import-api', () => ({ ...mocks, applyImportPlan: vi.fn(), analyzeInventoryText: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ user: { uid: 'qa' }, reloadInventory: vi.fn() }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchBackendInventory.mockResolvedValue([{ imei: '990000000001489', status: 'VENDIDO' }]);
  mocks.fetchArchivedInventory.mockResolvedValue([{ imei: '990000000001026' }]);
  mocks.analyzeImport.mockResolvedValue({ rows: [{ model: 'iPhone QA', imei: '990000000001489', price: '850' }, { model: 'iPhone QA', imei: '990000000001489', price: '900' }, { model: 'Archivado QA', imei: '990000000001026', color: 'Rojo', price: '500' }], currency: 'USD', plan: [{ name: 'Hoja 1', include: true, mapping: [{ header: 'Modelo', field: 'model' }] }], summary: { sheetCount: 1, rowCount: 3, sheets: [] } });
});
async function preview() {
  render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><ImportHost kind="inv" /></DeskProvider>);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Modelo,Precio\niPhone QA,850'], 'qa.csv', { type: 'text/csv' }));
}
it('avisa antes de confirmar, cuenta equipos únicos e incluye vendidos y archivados', async () => {
  await preview();
  const warning = await screen.findByTestId('import-imei-warning');
  expect(warning).toHaveTextContent('2 actualizaciones por IMEI');
  expect(warning).toHaveAttribute('title', 'Campos del archivo que pueden reemplazar datos: Modelo, Precio, Color. Los campos omitidos se conservan.');
  expect(warning.closest('.imp-review-notices')).not.toBeNull();
  expect(screen.getByTestId('import-summary').querySelector('.import-imei-warning')).toBeNull();
  expect(mocks.importBackendRows).not.toHaveBeenCalled();
});
it('bloquea la vista previa si falla la consulta de IMEI existentes', async () => {
  mocks.fetchArchivedInventory.mockRejectedValue(new Error('No se pudo consultar el archivo'));
  await preview();
  expect(await screen.findByText('No se pudo consultar el archivo')).toBeVisible();
  expect(screen.queryByTestId('import-preview-count')).not.toBeInTheDocument();
  expect(mocks.importBackendRows).not.toHaveBeenCalled();
});
it('no avisa si los IMEI del archivo son nuevos', async () => {
  mocks.fetchBackendInventory.mockResolvedValue([]);
  mocks.fetchArchivedInventory.mockResolvedValue([]);
  await preview();
  await screen.findByTestId('import-preview-count');
  expect(screen.queryByTestId('import-imei-warning')).not.toBeInTheDocument();
});

it('confirma campos personalizados junto con estado original, ingreso y detalle batería', async () => {
  mocks.importBackendRows.mockResolvedValue({ imported: 1, updated: 0, errors: [] });
  mocks.analyzeImport.mockResolvedValueOnce({
    rows: [{ model: 'iPhone QA', price: '', status: 'EN_REVISION', originalStatus: 'SIN SERVICIO',
      serial: 'SERIE-FICTICIA', entryDate: '2026-10-15', batteryHealth: '85%', batteryNote: 'Batería cambiada',
      supplierName: 'Proveedor ficticio', 'custom:reparaciones': '2', _sourceRow: '7' }],
    currency: 'USD', plan: [{ name: 'Hoja 1', include: true, mapping: [{ header: 'Modelo', field: 'model' }] }], summary: { sheetCount: 1, rowCount: 1, sheets: [] },
  });
  await preview();
  await userEvent.click(await screen.findByRole('button', { name: 'Importar 1 equipo' }));
  await waitFor(() => expect(mocks.importBackendRows).toHaveBeenCalled());
  expect(mocks.importBackendRows.mock.calls[0][2]).toEqual([expect.objectContaining({
    sourceRow: 7, entryDate: '2026-10-15', batteryHealth: '85%', batteryNote: 'Batería cambiada',
    supplierName: 'Proveedor ficticio', status: 'EN_REVISION',
    customFields: { serial: 'SERIE-FICTICIA', originalStatus: 'SIN SERVICIO', reparaciones: '2' },
  })]);
});
