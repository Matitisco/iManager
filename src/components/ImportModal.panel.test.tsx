import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import { parseWorkbook } from '../utils/parse-workbook';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';

vi.mock('../utils/parse-workbook', () => ({ parseWorkbook: vi.fn() }));
const scrollIntoView = vi.fn();
Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scrollIntoView });
beforeEach(() => {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
});
afterEach(() => vi.useRealTimers());
const fields = [
  { key: 'model', label: 'Modelo', required: true }, { key: 'price', label: 'Precio', required: false },
  { key: 'color', label: 'Color', required: false }, { key: 'supplier', label: 'Proveedor', required: false },
];
const stock = [['Modelo', 'Precio', 'Obs. interna', 'Vacía', 'Calidad', 'Ubicación'],
  ['iPhone 13', '420', 'pantalla', '', 'A', 'Local'], ['iPhone 14', '520', 'ok', ' ', 'B', 'Depósito']];
function sheetPlan(name = 'Stock'): ImportSheetPlan {
  return { name, include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 3, condition: '',
    mapping: stock[0].map((header, columnIndex) => ({ header, columnIndex, field: ['model', 'ignore', 'ignore', 'ignore', 'custom:quality', 'custom:location'][columnIndex] })),
    splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD' };
}
function recalculate(plan: ImportSheetPlan[], sheets: ImportSheetPayload[]): ImportAnalysis {
  const rows = plan.filter(item => item.include && item.mapping.some(column => column.field === 'model')).flatMap(item =>
    sheets.find(sheet => sheet.name === item.name)!.rows.slice(item.dataStartRow - 1, item.dataEndRow).map((row, index) => ({
      ...Object.fromEntries(item.mapping.filter(column => column.field !== 'ignore').map(column => [column.field, row[column.columnIndex!] || ''])),
      currency: 'USD', _sourceSheet: item.name, _sourceRow: String(item.dataStartRow + index),
    })));
  return { source: 'heuristic', notice: null, currency: 'USD', plan, rows,
    missingRequiredFields: plan.some(item => item.include && !item.mapping.some(column => column.field === 'model')) ? ['model'] : [],
    suggestedDefinitions: [{ entity: 'inventory', key: 'location', label: 'Ubicación', type: 'text', order: 1 }],
    summary: { rowCount: rows.length, sheetCount: sheets.length, sheets: plan.map(item => ({ name: item.name, included: item.include, rows: rows.filter(row => row._sourceSheet === item.name).length, condition: '' })) } };
}
async function setup(options: { plan?: ImportSheetPlan[]; sheets?: ImportSheetPayload[]; width?: number } = {}) {
  if (options.width) vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes('max-width') && options.width! < 700, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  const sheets = options.sheets ?? [{ name: 'Stock', rows: stock }];
  vi.mocked(parseWorkbook).mockResolvedValue({ sheetNames: sheets.map(item => item.name), getSheet: name => sheets.find(item => item.name === name)!.rows });
  const value = recalculate(options.plan ?? [sheetPlan()], sheets);
  const onApply = vi.fn(async (_sheets: ImportSheetPayload[], plan: ImportSheetPlan[], _refresh: boolean): Promise<ImportAnalysis> => recalculate(plan, sheets));
  const onImport = vi.fn(async (_rows: Record<string, string>[], _definitions?: unknown) => ({ imported: 2, updated: 0, errors: [] }));
  const onClose = vi.fn();
  const view = render(<ImportModal fields={fields} nouns={{ one: 'equipo', many: 'equipos' }}
    customFieldDefinitions={[{ id: 'quality-id', entity: 'inventory', key: 'quality', label: 'Calidad', type: 'text', order: 0 }]}
    onAnalyze={vi.fn(async () => value)} onApply={onApply} onImport={onImport} onClose={onClose} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['fixture'], 'stock.xlsx'));
  await screen.findByTestId('import-summary');
  return { ...view, onApply, onImport, onClose, value, sheets };
}
const card = (name = 'Precio') => within(screen.getByRole('article', { name: `Columna ${name}` }));
async function choose(header: string, name: RegExp | string) {
  await userEvent.click(card(header).getByRole('combobox'));
  await userEvent.click(screen.getByRole('option', { name }));
}
const table = () => within(screen.getByRole('table', { name: 'Vista previa de equipos' }));

it.each([1440, 1024, 390])('abre una sola pantalla y confirma sin ajuste a %i px', async width => {
  const { onImport } = await setup({ width });
  expect(screen.getByRole('dialog', { name: 'Importar equipos' })).toHaveClass('sheet-frame', 'imp-review-sheet');
  expect(screen.queryByTestId('import-adjust-open')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getByText('Detectamos 1 hoja, 2 equipos')).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(6);
  expect(screen.getByRole('complementary')).toHaveTextContent('2 por revisar');
  expect(screen.getByRole('group', { name: 'Encabezado del archivo' })).not.toBeVisible();
  const confirm = screen.getByTestId('import-confirm');
  expect(confirm.closest('.sheet-foot')).toBeInTheDocument();
  expect(confirm.parentElement?.children).toHaveLength(2);
  await userEvent.click(confirm);
  expect(onImport).toHaveBeenCalledOnce();
  expect(await screen.findByText('Importación completada')).toBeVisible();
});

it('asigna una descartada, actualiza la tabla y descarta el destino anterior al reutilizarlo', async () => {
  const { onApply, onImport } = await setup();
  expect(table().getAllByText('A definir')).toHaveLength(2);
  await choose('Precio', 'Precio');
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  await waitFor(() => expect(table().getByText('420')).toBeVisible());
  expect(table().getByRole('columnheader', { name: /Precio/ })).toHaveTextContent('Excel · B');
  await choose('Obs. interna', 'Precio');
  await waitFor(() => expect(card('Precio').getByRole('combobox')).toHaveTextContent('Descartar'));
  await waitFor(() => expect(table().getByText('pantalla')).toBeVisible());
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][0][0]).toMatchObject({ price: 'pantalla' });
});

it('descarta una asignada y vuelve a precio a definir sin bloquear la importación', async () => {
  const plan = sheetPlan(); plan.mapping[1].field = 'price';
  await setup({ plan: [plan] });
  await choose('Precio', 'Descartar');
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
  expect(table().getAllByText('A definir')).toHaveLength(2);
  expect(screen.getByRole('complementary')).toHaveTextContent('2 por revisar');
});

it('marca Falta Modelo, mantiene el motivo visible y recupera la hoja al asignarlo', async () => {
  const plan = sheetPlan(); plan.include = false; plan.mapping[0].field = 'ignore';
  const { onApply, onImport } = await setup({ plan: [plan] });
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  expect(screen.getByRole('table').querySelector('[data-preview-key="model"]')).toHaveTextContent('Falta Modelo');
  expect(screen.getByRole('complementary')).toHaveTextContent('Falta Modelo');
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport).not.toHaveBeenCalled();
  await choose('Modelo', 'Modelo');
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(onApply.mock.calls[0][1][0].include).toBe(true);
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
});

it.each(['Texto', 'Fecha', 'Número'])('crea un campo %s inline con validaciones y lo manda al confirmar', async label => {
  const { onImport } = await setup();
  await choose('Obs. interna', 'Nuevo campo…');
  const form = within(screen.getByRole('group', { name: 'Nuevo campo' }));
  await userEvent.click(form.getByRole('button', { name: 'Crear campo' }));
  expect(form.getByText('Ingresá un nombre')).toBeVisible();
  for (const duplicate of ['calidad', 'UBICACIÓN', 'Modelo']) {
    await userEvent.clear(form.getByRole('textbox'));
    await userEvent.type(form.getByRole('textbox'), duplicate);
    await userEvent.click(form.getByRole('button', { name: 'Crear campo' }));
    expect(form.getByText('Ya existe un campo con ese nombre')).toBeVisible();
  }
  await userEvent.clear(form.getByRole('textbox'));
  await userEvent.type(form.getByRole('textbox'), 'Reparaciones');
  await userEvent.click(form.getByRole('button', { name: label }));
  await userEvent.click(form.getByRole('button', { name: 'Crear campo' }));
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
  expect(table().getByRole('columnheader', { name: /Reparaciones/ })).toHaveTextContent('Excel · C');
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Reparaciones', type: label === 'Fecha' ? 'date' : label === 'Número' ? 'number' : 'text' })]));
});

it('vincula selección y scroll de tabla/panel y consume Escape antes de cerrar', async () => {
  const { onClose } = await setup({ width: 390 });
  await userEvent.click(screen.getByRole('button', { name: /Columnas \(/ }));
  expect(screen.getByRole('complementary')).toHaveClass('imp-panel-open');
  await choose('Obs. interna', 'Nuevo campo…');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('group', { name: 'Nuevo campo' })).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('complementary')).not.toHaveClass('imp-panel-open');
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(table().getByRole('button', { name: /^Modelo/ }));
  await waitFor(() => expect(screen.getByRole('article', { name: 'Columna Modelo' })).toHaveFocus());
  expect(screen.getByRole('article', { name: 'Columna Modelo' })).toHaveClass('imp-selected');
  expect(scrollIntoView).toHaveBeenCalled();
  await userEvent.click(card('Obs. interna').getByText('Obs. interna'));
  expect(table().getByRole('columnheader', { name: /Obs. interna/ })).toHaveClass('imp-selected');
});

it('reordena y redimensiona con teclado sin modificar el plan ni el envío', async () => {
  const { onApply, onImport, value } = await setup();
  const grip = table().getByRole('button', { name: 'Reordenar Precio' });
  grip.focus(); await userEvent.keyboard('{ArrowLeft}');
  expect(table().getAllByRole('columnheader').slice(0, 3).map(node => node.dataset.previewKey)).toEqual(['model', 'price', 'color']);
  expect(grip).toHaveFocus();
  const edge = table().getByRole('separator', { name: 'Ancho de Precio' });
  edge.focus(); await userEvent.keyboard('{ArrowRight}');
  expect(edge).toHaveAttribute('aria-valuenow', '160');
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][0]).toEqual(value.rows);
});

it('redimensiona con pointer events de mouse y touch y permite reordenar desde el asa', async () => {
  const { onApply } = await setup();
  // jsdom does not implement PointerEvent; keep the browser pointer coordinates.
  vi.stubGlobal('PointerEvent', MouseEvent);
  try {
    const edge = table().getByRole('separator', { name: 'Ancho de Precio' });
    for (const pointerType of ['mouse', 'touch']) {
      fireEvent.pointerDown(edge, { clientX: 100, button: 0, pointerType });
      fireEvent.pointerMove(edge, { clientX: 140, pointerType });
      fireEvent.pointerUp(edge, { clientX: 140, pointerType });
    }
    expect(edge).toHaveAttribute('aria-valuenow', '220');
    const grip = table().getByRole('button', { name: 'Reordenar Precio' });
    fireEvent.pointerDown(grip, { clientX: 340, button: 0 });
    fireEvent.pointerMove(grip, { clientX: 190 });
    fireEvent.pointerUp(grip, { clientX: 190 });
    expect(table().getAllByRole('columnheader')[1]).toHaveAttribute('data-preview-key', 'price');
    expect(onApply).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});

it('debounce agrupa cambios, mantiene filas y descarta respuestas viejas: último gana', async () => {
  const { onApply, value, sheets } = await setup();
  let first!: (value: ImportAnalysis) => void;
  onApply.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }));
  vi.useFakeTimers();
  const native = (header: string) => screen.getByRole('article', { name: `Columna ${header}` }).querySelector('select')!;
  fireEvent.change(native('Precio'), { target: { value: 'price' } });
  fireEvent.change(native('Obs. interna'), { target: { value: 'supplier' } });
  expect(onApply).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(onApply).toHaveBeenCalledOnce();
  expect(table().getByText('iPhone 13')).toBeVisible();
  fireEvent.change(native('Precio'), { target: { value: 'color' } });
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(onApply).toHaveBeenCalledTimes(2);
  const newest = recalculate(onApply.mock.calls[1][1], sheets);
  expect(screen.getByTestId('import-confirm')).toBeEnabled();
  await act(async () => first(value));
  expect(card('Precio').getByRole('combobox')).toHaveTextContent('Color');
  expect(table().getByRole('columnheader', { name: /Color/ })).toHaveTextContent('Excel · B');
  expect(table().getByText(newest.rows[0].color)).toBeVisible();
});

it('restaura la última asignación válida si apply falla y permite reintentar', async () => {
  const { onApply, onImport } = await setup();
  await choose('Precio', 'Precio');
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
  onApply.mockRejectedValueOnce(new Error('No se pudo actualizar la importación.'));
  await choose('Precio', 'Descartar');
  expect(await screen.findByText('No se pudo actualizar la importación.')).toBeVisible();
  expect(card('Precio').getByRole('combobox')).toHaveTextContent('Precio');
  expect(table().getByRole('columnheader', { name: /Precio/ })).toHaveTextContent('Excel · B');
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][0][0]).toMatchObject({ price: '420' });
});

it('cancela el debounce al desmontar', async () => {
  const { onApply, unmount } = await setup();
  vi.useFakeTimers();
  const select = screen.getByRole('article', { name: 'Columna Precio' }).querySelector('select')!;
  fireEvent.change(select, { target: { value: 'price' } });
  // Volver remains disabled during a recalculation; Escape can close the review.
  expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
  unmount();
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(onApply).not.toHaveBeenCalled();
});

it('cambia hojas y encabezados y conserva inclusión y columnas físicas', async () => {
  const first = sheetPlan(); const second = sheetPlan('Otra');
  const { onApply } = await setup({ plan: [first, second], sheets: [{ name: 'Stock', rows: stock }, { name: 'Otra', rows: stock }] });
  await userEvent.click(screen.getByRole('combobox', { name: 'Hoja a revisar' }));
  await userEvent.click(screen.getByRole('option', { name: 'Otra' }));
  await userEvent.click(screen.getByLabelText('Incluir hoja Stock'));
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
  expect(onApply.mock.calls[0][1][0].include).toBe(false);
  await userEvent.click(screen.getByText('Encabezado · Fila 1'));
  await userEvent.click(screen.getByRole('button', { name: 'Sin encabezado' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
  expect(onApply.mock.calls[1][2]).toBe(true);
  expect(onApply.mock.calls[1][1][1]).toMatchObject({ headerRow: 0, dataStartRow: 1 });
  expect(screen.getByRole('article', { name: 'Columna A' })).toBeInTheDocument();
});
