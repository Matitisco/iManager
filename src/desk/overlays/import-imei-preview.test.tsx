import { render, screen } from '@testing-library/react';
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
  expect(warning).toHaveTextContent('Se actualizarán 2 equipos existentes por IMEI');
  expect(warning).toHaveTextContent('Modelo, Precio, Color');
  expect(warning).not.toHaveTextContent('Batería');
  expect(warning).toHaveTextContent('Los campos omitidos se conservan');
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
