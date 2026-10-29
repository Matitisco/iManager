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
async function setup(options: { plan?: ImportSheetPlan[]; sheets?: ImportSheetPayload[]; width?: number; fields?: typeof fields; source?: ImportAnalysis['source'] } = {}) {
  if (options.width) vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes('max-width') && options.width! < 700, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  const sheets = options.sheets ?? [{ name: 'Stock', rows: stock }];
  vi.mocked(parseWorkbook).mockResolvedValue({ sheetNames: sheets.map(item => item.name), getSheet: name => sheets.find(item => item.name === name)!.rows });
  const value = recalculate(options.plan ?? [sheetPlan()], sheets);
  value.source = options.source ?? value.source;
  const onApply = vi.fn(async (_sheets: ImportSheetPayload[], plan: ImportSheetPlan[], _refresh: boolean): Promise<ImportAnalysis> => recalculate(plan, sheets));
  const onImport = vi.fn(async (_rows: Record<string, string>[], _definitions?: unknown) => ({ imported: 2, updated: 0, errors: [] }));
  const onClose = vi.fn();
  const view = render(<ImportModal fields={options.fields ?? fields} nouns={{ one: 'equipo', many: 'equipos' }}
    customFieldDefinitions={[{ id: 'quality-id', entity: 'inventory', key: 'quality', label: 'Calidad', type: 'text', order: 0 }]}
    onAnalyze={vi.fn(async () => value)} onApply={onApply} onImport={onImport} onClose={onClose} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['fixture'], 'stock.xlsx'));
  await screen.findByTestId('import-summary');
  return { ...view, onApply, onImport, onClose, value, sheets };
}
const header = (name: string) => screen.getByRole('button', { name: `Importar ${name} como` }).closest('th')!;
const trigger = (name: string) => screen.getByRole('button', { name: `Importar ${name} como` });
const table = () => within(screen.getByRole('table', { name: 'Vista previa de equipos' }));
const picker = () => screen.getByRole('dialog', { name: /^Importar [A-Z]+ ·/ });
async function choose(source: string, destination: string) {
  await userEvent.click(trigger(source));
  await userEvent.click(within(picker()).getByRole('button', { name: destination }));
}
function chooseNow(source: string, destination: string) {
  fireEvent.click(trigger(source));
  fireEvent.click(within(picker()).getByRole('button', { name: destination }));
}

it.each([1440, 1024, 390])('revisa y confirma sin panel lateral a %i px', async width => {
  const { onImport } = await setup({ width });
  expect(screen.getByRole('dialog', { name: 'Importar equipos' })).toHaveClass('sheet-frame', 'imp-review-sheet');
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(table().getAllByRole('columnheader')).toHaveLength(6);
  expect(screen.getByRole('button', { name: '3 sin asignar' })).toBeVisible();
  expect(screen.queryByLabelText('Incluir hoja Stock')).not.toBeInTheDocument();
  const confirm = screen.getByTestId('import-confirm');
  expect(confirm.closest('.sheet-foot')).toBeInTheDocument();
  await userEvent.click(confirm);
  expect(onImport).toHaveBeenCalledOnce();
  expect(await screen.findByText('Importación completada')).toBeVisible();
});

it('busca campos sin tildes, muestra su letra y mueve el destino usado', async () => {
  const { onApply, onImport } = await setup();
  await choose('Precio', 'Precio');
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(trigger('Precio')).toHaveTextContent('Precio');
  expect(header('Precio')).toHaveTextContent('Excel · B');
  await userEvent.click(trigger('Obs. interna'));
  await userEvent.type(screen.getByRole('textbox', { name: 'Buscar campo' }), 'pre');
  expect(within(picker()).getByRole('button', { name: 'Precio' })).toBeVisible();
  expect(within(picker()).queryByRole('button', { name: 'Modelo' })).not.toBeInTheDocument();
  await userEvent.click(within(picker()).getByRole('button', { name: 'Precio' }));
  expect(trigger('Precio')).toHaveTextContent('Sin asignar');
  expect(header('Precio')).toHaveClass('imp-unassigned');
  await waitFor(() => expect(table().getByText('pantalla')).toBeVisible());
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][0][0]).toMatchObject({ price: 'pantalla' });
});

it('descarta sin bloquear y permite reasignar una columna descartada', async () => {
  const { onApply } = await setup();
  await choose('Precio', 'Descartar');
  expect(header('Precio')).not.toHaveClass('imp-unassigned');
  expect(trigger('Precio')).toHaveTextContent('Descartada');
  expect(screen.getByRole('button', { name: '2 sin asignar' })).toBeVisible();
  await choose('Precio', 'Precio');
  await waitFor(() => expect(onApply).toHaveBeenCalled());
  await userEvent.click(trigger('Obs. interna'));
  await userEvent.click(within(picker()).getByRole('button', { name: 'Precio' }));
  expect(header('Precio')).toHaveClass('imp-unassigned');
});

it('reincluye la hoja al asignar Modelo y mantiene el error hasta reaplicar', async () => {
  const plan = sheetPlan(); plan.include = false; plan.mapping[0].field = 'ignore';
  const { onApply, onImport } = await setup({ plan: [plan] });
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  expect(screen.getByText('Incluí al menos una hoja para importar.')).toBeVisible();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport).not.toHaveBeenCalled();
  await choose('Modelo', 'Modelo');
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(onApply.mock.calls[0][1][0].include).toBe(true);
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
});

it.each(['Texto', 'Fecha', 'Número'])('crea un campo %s con validaciones y lo confirma', async label => {
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
  expect(trigger('Obs. interna')).toHaveTextContent('Reparaciones');
  expect(header('Obs. interna')).toHaveTextContent('Excel · C');
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Reparaciones', type: label === 'Fecha' ? 'date' : label === 'Número' ? 'number' : 'text' })]));
});

it.each([1440, 390])('Escape cierra selector y restaura foco sin cerrar importación a %i', async width => {
  const { onClose } = await setup({ width });
  await userEvent.click(trigger('Obs. interna'));
  expect(screen.getByRole('textbox', { name: 'Buscar campo' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('textbox', { name: 'Buscar campo' })).not.toBeInTheDocument();
  await waitFor(() => expect(trigger('Obs. interna')).toHaveFocus());
  expect(onClose).not.toHaveBeenCalled();
});

it('separa dudas amarillas y sin asignar rojas con recorridos independientes en orden visual', async () => {
  const plan = sheetPlan();
  plan.mapping[0].review = ['Revisar modelo'];
  plan.mapping[4].review = ['Revisar calidad'];
  plan.mapping[1].review = ['Sin destino confiable'];
  await setup({ plan: [plan], source: 'model' });
  for (const source of ['Modelo', 'Calidad']) {
    expect(header(source)).toHaveClass('imp-pending');
    expect(header(source)).not.toHaveClass('imp-unassigned');
    expect(trigger(source)).toHaveAccessibleDescription(/Por revisar/);
  }
  expect(header('Precio')).toHaveClass('imp-unassigned');
  expect(header('Precio')).not.toHaveClass('imp-pending');
  expect(trigger('Precio')).not.toHaveAccessibleDescription(/Por revisar/);
  const grip = table().getByRole('button', { name: /Arrastrar para reordenar · Precio/ });
  grip.focus(); await userEvent.keyboard('{ArrowRight}');
  const preview = screen.getByTestId('import-preview'); preview.scrollTop = 44;
  for (const [chip, source] of [
    ['2 por revisar', 'Modelo'], ['3 sin asignar', 'Obs. interna'],
    ['2 por revisar', 'Calidad'], ['3 sin asignar', 'Precio'],
    ['2 por revisar', 'Modelo'], ['3 sin asignar', 'Vacía'], ['3 sin asignar', 'Obs. interna'],
  ]) {
    await userEvent.click(screen.getByRole('button', { name: chip }));
    expect(trigger(source)).toHaveFocus();
    expect(preview.scrollTop).toBe(44);
    expect(header(source)).toHaveClass('imp-selected');
  }
  await choose('Modelo', 'Modelo');
  expect(header('Modelo')).not.toHaveClass('imp-pending');
  expect(screen.getByRole('button', { name: '1 por revisar' })).toBeVisible();
  await choose('Calidad', 'Calidad · Texto');
  await waitFor(() => expect(screen.queryByRole('button', { name: /por revisar/ })).not.toBeInTheDocument());
  expect(header('Calidad')).not.toHaveClass('imp-pending');
  expect(screen.getByRole('button', { name: '3 sin asignar' })).toBeVisible();
});

it('en 16 columnas cuenta y recorre solo G y L–P sin mostrar por revisar', async () => {
  const headers = Array.from({ length: 16 }, (_, i) => `Columna ${i + 1}`);
  const red = [6, 11, 12, 13, 14, 15];
  const plan = sheetPlan();
  plan.mapping = headers.map((header, columnIndex) => ({ header, columnIndex,
    field: red.includes(columnIndex) ? 'ignore' : columnIndex === 0 ? 'model' : `custom:campo_${columnIndex}`,
    review: columnIndex === 6 ? ['No se pudo asignar'] : [],
  }));
  const { onApply } = await setup({ plan: [plan], sheets: [{ name: 'Stock', rows: [headers, headers.map((_, i) => i === 0 ? 'iPhone 13' : `Dato ${i}`)] }] });
  expect(screen.queryByRole('button', { name: /por revisar/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '6 sin asignar' })).toBeVisible();
  expect(document.querySelectorAll('th.imp-pending')).toHaveLength(0);
  expect(document.querySelectorAll('th.imp-unassigned')).toHaveLength(6);
  for (const i of [...red, red[0]]) {
    await userEvent.click(screen.getByRole('button', { name: '6 sin asignar' }));
    expect(trigger(headers[i])).toHaveFocus();
  }
  expect(onApply).not.toHaveBeenCalled();
});

it('oculta ambos chips al descartar las últimas sin asignar y no cuenta dudas descartadas', async () => {
  const plan = sheetPlan(); plan.mapping[1].review = ['Revisar precio'];
  await setup({ plan: [plan] });
  for (const source of ['Precio', 'Obs. interna', 'Vacía']) await choose(source, 'Descartar');
  await waitFor(() => expect(screen.queryByRole('button', { name: /sin asignar|por revisar|Todo asignado/ })).not.toBeInTheDocument());
  expect(document.querySelectorAll('th.imp-pending, th.imp-unassigned')).toHaveLength(0);
});

it('Asignar abre Precio en primera libre y permite repetir el acceso', async () => {
  await setup();
  for (let i = 0; i < 2; i++) {
    await userEvent.click(screen.getByRole('button', { name: 'Asignar columna de precio' }));
    expect(picker()).toHaveAccessibleName('Importar B · Precio como');
    expect(screen.getByRole('textbox', { name: 'Buscar campo' })).toHaveValue('Precio');
    await userEvent.keyboard('{Escape}');
  }
});

it('Asignar usa la primera columna física cuando no hay libres', async () => {
  const plan = sheetPlan(); plan.mapping.forEach((column, index) => { column.field = index === 0 ? 'model' : `custom:campo_${index}`; });
  await setup({ plan: [plan] });
  await userEvent.click(screen.getByRole('button', { name: 'Asignar columna de precio' }));
  expect(picker()).toHaveAccessibleName('Importar A · Modelo como');
  expect(screen.getByRole('textbox', { name: 'Buscar campo' })).toHaveValue('Precio');
});

it('teclado y pointer redimensionan/reordenan sin modificar el plan', async () => {
  const { onApply, onImport, value } = await setup();
  const grip = table().getByRole('button', { name: /Arrastrar para reordenar · Precio/ });
  grip.focus(); await userEvent.keyboard('{ArrowRight}');
  expect(table().getAllByRole('columnheader').slice(0, 3).map(node => node.dataset.columnIndex)).toEqual(['0', '2', '1']);
  const edge = table().getByRole('separator', { name: /Ancho de columna sin usar B/ });
  edge.focus(); await userEvent.keyboard('{ArrowRight}');
  expect(edge).toHaveAttribute('aria-valuenow', '180');
  vi.stubGlobal('PointerEvent', MouseEvent);
  try {
    fireEvent.pointerDown(edge, { clientX: 100, button: 0 });
    fireEvent.pointerMove(edge, { clientX: 140 });
    fireEvent.pointerUp(edge, { clientX: 140 });
    expect(edge).toHaveAttribute('aria-valuenow', '220');
    fireEvent.pointerDown(grip, { clientX: 500, button: 0 });
    fireEvent.pointerMove(grip, { clientX: 190 });
    fireEvent.pointerUp(grip, { clientX: 190 });
    expect(table().getAllByRole('columnheader')[1]).toHaveAttribute('data-column-index', '1');
  } finally { vi.unstubAllGlobals(); }
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][0]).toEqual(value.rows);
});

it('debounce agrupa cambios y descarta respuestas viejas', async () => {
  const { onApply, value } = await setup();
  let first!: (value: ImportAnalysis) => void;
  onApply.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }));
  vi.useFakeTimers();
  chooseNow('Precio', 'Precio'); chooseNow('Obs. interna', 'Proveedor');
  expect(onApply).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(onApply).toHaveBeenCalledOnce();
  expect(table().getByText('iPhone 13')).toBeVisible();
  chooseNow('Precio', 'Color');
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(onApply).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('import-confirm')).toBeEnabled();
  await act(async () => first(value));
  expect(trigger('Precio')).toHaveTextContent('Color');
  expect(table().getByText('420')).toBeVisible();
});

it('restaura plan válido ante error y confirma sus filas', async () => {
  const { onApply, onImport } = await setup();
  await choose('Precio', 'Precio');
  await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
  onApply.mockRejectedValueOnce(new Error('No se pudo actualizar la importación.'));
  await choose('Precio', 'Descartar');
  expect(await screen.findByText('No se pudo actualizar la importación.')).toBeVisible();
  expect(trigger('Precio')).toHaveTextContent('Precio');
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0][0][0]).toMatchObject({ price: '420' });
});

it('cancela debounce al desmontar', async () => {
  const { onApply, unmount } = await setup();
  vi.useFakeTimers(); chooseNow('Precio', 'Precio');
  expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
  unmount(); await act(() => vi.advanceTimersByTimeAsync(300));
  expect(onApply).not.toHaveBeenCalled();
});

it('conserva descartes, orden y ancho físicos entre hojas con encabezados duplicados', async () => {
  const sheets = ['Stock', 'Otra'].map(name => ({ name, rows: stock.map(row => [...row]) }));
  sheets.forEach(sheet => { sheet.rows[0][2] = 'Precio'; });
  await setup({ sheets, plan: sheets.map(sheet => sheetPlan(sheet.name)) });
  await userEvent.click(screen.getByTestId('import-column-1'));
  await userEvent.click(within(picker()).getByRole('button', { name: 'Descartar' }));
  expect(screen.getByTestId('import-column-1')).toHaveTextContent('Descartada');
  expect(screen.getByTestId('import-column-2')).toHaveTextContent('Sin asignar');
  await userEvent.click(screen.getByRole('button', { name: 'Otra' }));
  expect(screen.getByTestId('import-column-1')).toHaveTextContent('Sin asignar');
  await userEvent.click(screen.getByRole('button', { name: 'Stock' }));
  expect(screen.getByTestId('import-column-1')).toHaveTextContent('Descartada');
});

it('edita el encabezado desde los avisos y cierra el popover sin cerrar la importación', async () => {
  const { onApply, onClose } = await setup();
  const trigger = () => screen.getByRole('button', { name: /Encabezado: .* · Cambiar/ });
  expect(trigger().closest('.imp-table-title')).toBeInTheDocument();
  await userEvent.click(trigger());
  expect(screen.getByRole('button', { name: 'Sin encabezado' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Sin encabezado' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  expect(trigger()).toHaveTextContent('Encabezado: sin encabezado · Cambiar');
  await userEvent.click(screen.getByRole('button', { name: 'Fila 1 es encabezado' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Fila de encabezado' }), { target: { value: '2' } });
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(3));
  expect(onApply.mock.calls[2][1][0]).toMatchObject({ headerRow: 2, dataStartRow: 3 });
  expect(onApply.mock.calls.every(call => call[2] === true)).toBe(true);
  await userEvent.keyboard('{Escape}');
  expect(trigger()).toHaveFocus();
  expect(screen.queryByRole('group', { name: 'Encabezado del archivo' })).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(trigger());
  await userEvent.click(screen.getByRole('heading', { name: /^Equipos a importar/ }));
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
});

it('muestra lectura desde la selección y análisis hasta resolver la vista previa', async () => {
  const sheets = [{ name: 'Stock', rows: stock }];
  let parsed!: (value: Awaited<ReturnType<typeof parseWorkbook>>) => void;
  let analyzed!: (value: ImportAnalysis) => void;
  vi.mocked(parseWorkbook).mockImplementationOnce(() => new Promise(resolve => { parsed = resolve; }));
  const onAnalyze = vi.fn(() => new Promise<ImportAnalysis>(resolve => { analyzed = resolve; }));
  render(<ImportModal fields={fields} onAnalyze={onAnalyze} onApply={vi.fn()} onImport={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Archivo a importar'), { target: { files: [new File(['fixture'], 'stock.xlsx')] } });
  expect(screen.getByText('Leyendo archivo…')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Elegir archivo CSV o XLSX' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
  await waitFor(() => expect(parsed).toBeTypeOf('function'));
  await act(async () => parsed({ sheetNames: ['Stock'], getSheet: () => stock }));
  expect(screen.queryByText('Leyendo archivo…')).not.toBeInTheDocument();
  expect(screen.getByText('Analizando columnas…')).toBeVisible();
  await act(async () => analyzed(recalculate([sheetPlan()], sheets)));
  expect(screen.getByTestId('import-summary')).toBeVisible();
  expect(screen.queryByTestId('import-reading')).not.toBeInTheDocument();
  expect(screen.queryByText('Analizando columnas…')).not.toBeInTheDocument();
});

it.each(['lectura', 'análisis', 'vacío', 'demasiadas filas'])('recupera el error de %s y permite elegir el mismo archivo otra vez', async failure => {
  const sheets = [{ name: 'Stock', rows: stock }];
  let reject!: (reason: Error) => void;
  const workbook = { sheetNames: ['Stock'], getSheet: () => stock };
  vi.mocked(parseWorkbook).mockResolvedValue(workbook);
  const onAnalyze = vi.fn(async () => recalculate([sheetPlan()], sheets));
  if (failure === 'lectura') vi.mocked(parseWorkbook).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  if (failure === 'análisis') onAnalyze.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  if (failure === 'vacío') vi.mocked(parseWorkbook).mockResolvedValueOnce({ sheetNames: ['Stock'], getSheet: () => [] });
  if (failure === 'demasiadas filas') vi.mocked(parseWorkbook).mockResolvedValueOnce({ sheetNames: ['Stock'], getSheet: () => Array.from({ length: 5001 }, () => ['iPhone 13']) });
  render(<ImportModal fields={fields} onAnalyze={onAnalyze} onApply={vi.fn()} onImport={vi.fn()} onClose={vi.fn()} />);
  const file = new File(['fixture'], 'stock.xlsx');
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), file);
  if (failure === 'lectura' || failure === 'análisis') {
    await waitFor(() => expect(reject).toBeTypeOf('function'));
    expect(screen.getByText(failure === 'lectura' ? 'Leyendo archivo…' : 'Analizando columnas…')).toBeVisible();
    await act(async () => reject(new Error('No se pudo leer el archivo. Probá de nuevo.')));
  }
  expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo leer|está vacío|supera las 5000/);
  expect(screen.queryByTestId('import-reading')).not.toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), file);
  expect(await screen.findByTestId('import-summary')).toBeVisible();
});

it('arrastra desde trigger en escritorio, mantiene scroll táctil y permite abrir después de drag táctil', async () => {
  const { onApply } = await setup({ width: 390 });
  class TestPointerEvent extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? 'mouse'; }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  try {
    const label = trigger('Precio');
    fireEvent.pointerDown(label, { clientX: 400 });
    fireEvent.pointerMove(label, { clientX: 397 });
    fireEvent.pointerUp(label, { clientX: 397 });
    fireEvent.click(label);
    expect(picker()).toBeVisible();
    await userEvent.keyboard('{Escape}');
    fireEvent.pointerDown(label, { clientX: 400 });
    fireEvent.pointerMove(label, { clientX: 700 });
    fireEvent.pointerUp(label, { clientX: 700 });
    fireEvent.click(label);
    expect(table().getAllByRole('columnheader')[1]).toHaveAttribute('data-column-index', '2');
    expect(screen.queryByRole('textbox', { name: 'Buscar campo' })).not.toBeInTheDocument();
    const manual = table().getAllByRole('columnheader').map(node => node.dataset.columnIndex);
    fireEvent.pointerDown(label, { clientX: 190, pointerType: 'touch' });
    fireEvent.pointerMove(label, { clientX: 700, pointerType: 'touch' });
    fireEvent.pointerUp(label, { clientX: 700, pointerType: 'touch' });
    expect(table().getAllByRole('columnheader').map(node => node.dataset.columnIndex)).toEqual(manual);
    const grip = within(header('Precio')).getByRole('button', { name: /Arrastrar para reordenar/ });
    fireEvent.pointerDown(grip, { clientX: 700, pointerType: 'touch' });
    fireEvent.pointerMove(grip, { clientX: 190, pointerType: 'touch' });
    fireEvent.pointerUp(grip, { clientX: 190, pointerType: 'touch' });
    expect(table().getAllByRole('columnheader')[1]).toHaveAttribute('data-column-index', '1');
    fireEvent.pointerDown(label, { pointerType: 'touch' });
    fireEvent.pointerUp(label, { pointerType: 'touch' });
    fireEvent.click(label);
    expect(picker()).toBeVisible();
    expect(onApply).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
