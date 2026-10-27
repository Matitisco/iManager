import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import { parseWorkbook } from '../utils/parse-workbook';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';

vi.mock('../utils/parse-workbook', () => ({ parseWorkbook: vi.fn() }));
const scrollIntoView = vi.fn();
Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scrollIntoView });
afterEach(() => vi.useRealTimers());
const fields = [
  { key: 'model', label: 'Modelo', required: true },
  { key: 'price', label: 'Precio', required: false },
  { key: 'supplier', label: 'Proveedor', required: false },
];
const stock = [
  ['Modelo', 'Precio', 'Obs. interna', 'Vacía', 'Calidad', 'Ubicación'],
  ['iPhone 13', '420', 'rev. pantalla', '', 'A', 'Local'],
  ['iPhone 14', '520', 'ok', ' ', 'B', 'Depósito'],
  ['iPhone 15', '620', '0', '', 'C', 'Local'],
];
function sheetPlan(name = 'Stock'): ImportSheetPlan {
  return { name, include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 4, condition: '',
    mapping: stock[0].map((header, columnIndex) => ({ header, columnIndex, field: ['model', 'price', 'ignore', 'ignore', 'custom:quality', 'custom:location'][columnIndex] })),
    splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD' };
}
async function setup(options: { plan?: ImportSheetPlan[]; sheets?: ImportSheetPayload[]; missing?: string[]; phone?: boolean; reducedMotion?: boolean } = {}) {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: Boolean(options.phone) && query.includes('max-width') || Boolean(options.reducedMotion) && query.includes('prefers-reduced-motion'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  const sheets = options.sheets ?? [{ name: 'Stock', rows: stock }];
  vi.mocked(parseWorkbook).mockResolvedValue({ sheetNames: sheets.map(item => item.name), getSheet: name => sheets.find(item => item.name === name)!.rows });
  const value: ImportAnalysis = { source: 'heuristic', notice: null, currency: 'USD', plan: options.plan ?? [sheetPlan()],
    rows: [{ model: 'iPhone 13', price: '420' }], missingRequiredFields: options.missing ?? [],
    suggestedDefinitions: [{ entity: 'inventory', key: 'location', label: 'Ubicación', type: 'text', order: 1 }],
    summary: { rowCount: 1, sheetCount: sheets.length, sheets: sheets.map(item => ({ name: item.name, included: true, rows: 1, condition: '' })) } };
  const onApply = vi.fn(async (_sheets: ImportSheetPayload[], plan: ImportSheetPlan[], _refresh: boolean): Promise<ImportAnalysis> => ({ ...value, plan,
    missingRequiredFields: plan.filter(item => item.include).some(item => !item.mapping.some(column => column.field === 'model')) ? ['model'] : [] }));
  const onImport = vi.fn(async () => ({ imported: 1, updated: 0, errors: [] }));
  const onStageChange = vi.fn();
  const view = render(<ImportModal fields={fields} nouns={{ one: 'equipo', many: 'equipos' }}
    customFieldDefinitions={[{ id: 'quality-id', entity: 'inventory', key: 'quality', label: 'Calidad', type: 'text', order: 0 }]}
    onAnalyze={vi.fn(async () => value)} onApply={onApply} onImport={onImport} onClose={vi.fn()} onStageChange={onStageChange} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['fixture'], 'stock.xlsx'));
  await userEvent.click(await screen.findByTestId('import-adjust-open'));
  return { ...view, onApply, onImport, onStageChange, value };
}
const next = () => userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
const previous = () => userEvent.click(screen.getByRole('button', { name: 'Atrás' }));
const card = (name = 'Obs. interna') => within(screen.getByRole('article', { name: `Columna ${name}` }));

it.each([false, true])('navega Columnas → Resumen → Importar y conserva mapping (móvil: %s)', async phone => {
  const { onImport, onStageChange } = await setup({ phone });
  const steps = within(screen.getByRole('navigation', { name: 'Pasos de ajuste de importación' }));
  expect(steps.getAllByRole('button')).toHaveLength(2);
  expect(steps.queryByRole('button', { name: 'Archivo' })).not.toBeInTheDocument();
  expect(steps.getByRole('button', { name: 'Resumen' })).toBeDisabled();
  expect(screen.getByRole('dialog', { name: 'Ajustar importación' })).toHaveClass('sheet-frame', 'imp-adjust-sheet');
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(steps.getByRole('button', { name: 'Columnas' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('group', { name: 'Encabezado del archivo' })).not.toBeVisible();
  const scroll = screen.getByTestId('import-adjust').closest('.sheet-scroll')!;
  scroll.scrollTop = 100;
  await next();
  expect(scroll.scrollTop).toBe(0);
  expect(steps.getByRole('button', { name: 'Columnas' })).toHaveClass('done');
  expect(steps.getByRole('button', { name: 'Resumen' })).toHaveAttribute('aria-current', 'step');
  const confirm = screen.getByRole('button', { name: 'Importar 1 equipo' });
  expect(confirm.closest('.sheet-foot')).toBeInTheDocument();
  expect(confirm.closest('.sheet-scroll')).toBeNull();
  expect(confirm.parentElement?.children).toHaveLength(2);
  expect(onStageChange).toHaveBeenLastCalledWith('mapping');
  await userEvent.click(confirm);
  expect(onImport).toHaveBeenCalledWith([{ model: 'iPhone 13', price: '420' }]);
  expect(await screen.findByText('Importación completada')).toBeVisible();
});

it('muestra solo descartadas con datos en el rango, con tres muestras', async () => {
  await setup();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('article', { name: 'Columna Obs. interna' })).toHaveClass('rev');
  for (const sample of ['rev. pantalla', 'ok', '0']) expect(card().getByText(sample)).toBeVisible();
  expect(screen.queryByRole('article', { name: 'Columna Vacía' })).not.toBeInTheDocument();
  expect(screen.queryByRole('article', { name: 'Columna Modelo' })).not.toBeInTheDocument();
});

it('ignora datos fuera del rango y permite seguir con un paso vacío', async () => {
  const plan = sheetPlan();
  plan.dataStartRow = 3; plan.dataEndRow = 3;
  const rows = stock.map(row => [...row]); rows[2][2] = '';
  await setup({ plan: [plan], sheets: [{ name: 'Stock', rows }] });
  expect(screen.getByText('No hay columnas para revisar')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await next();
  expect(screen.getByTestId('import-confirm')).toBeEnabled();
});

it('mantiene una pendiente resuelta al volver desde Resumen y reinicia al reabrir el ajuste', async () => {
  const { onApply } = await setup();
  await userEvent.click(card().getByRole('button', { name: 'Campo existente' }));
  await userEvent.click(card().getByRole('combobox', { name: 'Importar Obs. interna como' }));
  await userEvent.click(screen.getByRole('option', { name: 'Proveedor' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(card().getByTestId('import-field-supplier')).toHaveTextContent('Proveedor');
  expect(card().getByLabelText('Asignada')).toBeInTheDocument();
  await next();
  await userEvent.click(screen.getByRole('button', { name: 'Columnas' }));
  expect(card().getByTestId('import-field-supplier')).toBeVisible();
  await next(); await previous();
  expect(card().getByTestId('import-field-supplier')).toBeVisible();
  await previous();
  await userEvent.click(screen.getByTestId('import-adjust-open'));
  expect(screen.getByRole('button', { name: 'Columnas' })).toHaveAttribute('aria-current', 'step');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByText('No hay columnas para revisar')).toBeVisible();
});

it('descartar conserva la tarjeta y el resumen distingue con datos / sin datos', async () => {
  const { onApply } = await setup();
  await userEvent.click(card().getByRole('button', { name: 'Descartar' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(card().getByRole('button', { name: 'Descartar' })).toHaveAttribute('aria-pressed', 'true');
  await next();
  const ignored = within(screen.getByRole('region', { name: 'Descartadas' }));
  expect(ignored.getByRole('heading')).toHaveTextContent('Descartadas2');
  expect(ignored.getByRole('button', { name: 'Cambiar columna C: Obs. interna' })).toHaveTextContent('Con datos');
  expect(ignored.getByRole('button', { name: 'Cambiar columna D: Vacía' })).toHaveTextContent('Sin datos');
});

it('agrupa campos estándar y personalizados existentes/borrador y permite cambiar cualquier fila', async () => {
  await setup(); await next();
  const existing = within(screen.getByRole('region', { name: 'Campos existentes' }));
  expect(existing.getByRole('heading')).toHaveTextContent('Campos existentes2');
  expect(existing.getAllByRole('button')).toHaveLength(2);
  const custom = within(screen.getByRole('region', { name: 'Campos nuevos' }));
  expect(custom.getByRole('heading')).toHaveTextContent('Campos nuevos2');
  expect(custom.getByRole('button', { name: 'Cambiar columna E: Calidad' })).toHaveTextContent('Calidad');
  expect(custom.getByRole('button', { name: 'Cambiar columna F: Ubicación' })).toHaveTextContent('Ubicación');
  await userEvent.click(existing.getByRole('button', { name: 'Cambiar columna A: Modelo' }));
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('article', { name: 'Columna Modelo' })).toHaveFocus();
  expect(card('Modelo').getByTestId('import-field-model')).toBeVisible();
  await next();
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar columna D: Vacía' }));
  expect(card('Vacía').getAllByText('—')).toHaveLength(3);
});

it('muestra todas las descartadas mientras falta Modelo y lo bloquea hasta asignarlo', async () => {
  const plan = sheetPlan(); plan.mapping[0].field = 'ignore';
  const { onApply, onImport } = await setup({ plan: [plan], missing: ['model'] });
  expect(screen.getByRole('alert')).toHaveTextContent('Falta asignar Modelo.');
  await userEvent.click(screen.getByRole('button', { name: 'Ir al campo obligatorio' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(card('Vacía')).toBeDefined();
  expect(screen.getByRole('article', { name: 'Columna Modelo' })).toHaveFocus();
  expect(screen.getByRole('article', { name: 'Columna Modelo' })).toHaveClass('flash');
  await next();
  expect(screen.getByRole('alert')).toHaveTextContent('Falta asignar Modelo.');
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  expect(onImport).not.toHaveBeenCalled();
  await previous();
  await userEvent.click(card('Modelo').getByRole('button', { name: 'Campo existente' }));
  await userEvent.click(card('Modelo').getByRole('combobox', { name: 'Importar Modelo como' }));
  await userEvent.click(screen.getByRole('option', { name: 'Modelo' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await next();
  expect(screen.getByTestId('import-confirm')).toBeEnabled();
});

it('bloquea la navegación mientras se aplica un mapeo y conserva la respuesta aceptada', async () => {
  const { onApply } = await setup();
  let finish!: (result: ImportAnalysis) => void;
  onApply.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await userEvent.click(card().getByRole('button', { name: 'Descartar' }));
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Columnas' })).toBeDisabled();
  await act(async () => finish({ source: 'heuristic', notice: null, currency: 'USD', rows: [{ model: 'iPhone 13' }], plan: [sheetPlan()], missingRequiredFields: [], summary: { rowCount: 1, sheetCount: 1, sheets: [] } }));
  await next();
  expect(screen.getByTestId('import-confirm')).toBeEnabled();
});

it('el encabezado abre colapsado en Columnas y conserva modos y fila personalizada con remapeo', async () => {
  const { onApply } = await setup();
  const settings = screen.getByText('Encabezado · Fila 1').closest('details')!;
  expect(settings).not.toHaveAttribute('open');
  expect(screen.getByRole('group', { name: 'Encabezado del archivo' })).not.toBeVisible();
  await userEvent.click(within(settings).getByText('Encabezado · Fila 1'));
  expect(settings).toHaveAttribute('open');
  await userEvent.click(screen.getByRole('button', { name: 'Sin encabezado' }));
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
  expect(onApply.mock.calls[0][1][0]).toMatchObject({ headerRow: 0, dataStartRow: 1 });
  expect(onApply.mock.calls[0][2]).toBe(true);
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Columna C' })).toHaveTextContent('Obs. interna');
  await userEvent.click(screen.getByRole('button', { name: 'Fila 1 es encabezado' }));
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(1));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
  await waitFor(() => expect(onApply).toHaveBeenCalledTimes(3));
  expect(onApply.mock.calls[2][1][0]).toMatchObject({ headerRow: 2, dataStartRow: 3 });
  expect(screen.getByRole('article', { name: 'Columna rev. pantalla' })).toHaveTextContent('ok');
});

it('Columnas conserva inclusión de hojas y ambos pasos usan solo la hoja activa', async () => {
  const other = { ...sheetPlan('Depósito'), mapping: [{ header: 'Equipo', columnIndex: 0, field: 'model' }, { header: 'Nota', columnIndex: 1, field: 'ignore' }] };
  const { onApply } = await setup({ plan: [sheetPlan(), other], sheets: [{ name: 'Stock', rows: stock }, { name: 'Depósito', rows: [['Equipo', 'Nota'], ['Moto G', 'revisar']] }] });
  await userEvent.click(screen.getByTestId('import-sheet-Stock'));
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(screen.getByTestId('import-sheet-Stock')).not.toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Depósito' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(card('Nota').getByText('revisar')).toBeVisible();
  expect(screen.getByTestId('import-sheet-Stock')).not.toBeChecked();
  await next();
  expect(screen.queryByTestId('import-sheet-Stock')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cambiar columna A: Equipo' })).toHaveTextContent('Modelo');
  expect(screen.queryByRole('button', { name: /Cambiar columna.*Obs. interna/ })).not.toBeInTheDocument();
  await previous();
  await userEvent.click(screen.getByRole('button', { name: 'Stock' }));
  expect(card().getByText('rev. pantalla')).toBeVisible();
});

it('crea un campo desde Columnas, lo conserva visible y lo incluye en Resumen e importación', async () => {
  const { onApply, onImport } = await setup();
  onApply.mockImplementationOnce(async (_sheets, plan) => {
    const field = plan[0].mapping.find(column => column.columnIndex === 2)!.field;
    return { source: 'heuristic', notice: null, currency: 'USD', plan, rows: [{ model: 'iPhone 13', price: '420', [field]: 'rev. pantalla' }], missingRequiredFields: [], summary: { rowCount: 1, sheetCount: 1, sheets: [] } };
  });
  await userEvent.click(card().getByRole('button', { name: 'Nuevo campo' }));
  const modal = within(screen.getByRole('dialog', { name: 'Nuevo campo' }));
  await userEvent.type(modal.getByRole('textbox'), 'Reparaciones');
  await userEvent.click(modal.getByRole('button', { name: 'Crear campo' }));
  await waitFor(() => expect(card().getByRole('combobox')).toHaveTextContent('Reparaciones · Texto'));
  expect(card().getByRole('button', { name: 'Nuevo campo' })).toHaveAttribute('aria-pressed', 'true');
  await next();
  expect(within(screen.getByRole('region', { name: 'Campos nuevos' })).getByRole('heading')).toHaveTextContent('Campos nuevos3');
  expect(screen.getByRole('button', { name: 'Cambiar columna C: Obs. interna' })).toHaveTextContent('Reparaciones');
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ model: 'iPhone 13' })], [expect.objectContaining({ label: 'Reparaciones', type: 'text' })]);
});


it.each([false, true])('muestra Cambiar en cada fila de los tres grupos (móvil: %s)', async phone => {
  const rows = stock.map(row => [...row]);
  rows[0][2] = 'Observaciones internas con un encabezado muy largo';
  const plan = sheetPlan(); plan.mapping[2].header = rows[0][2];
  await setup({ phone, plan: [plan], sheets: [{ name: 'Stock', rows }] });
  await next();
  expect(screen.getAllByText('Cambiar')).toHaveLength(6);
  for (const label of ['Campos existentes', 'Campos nuevos', 'Descartadas']) {
    const group = within(screen.getByRole('region', { name: label }));
    expect(group.getAllByText('Cambiar')).toHaveLength(2);
    for (const row of group.getAllByRole('button')) {
      expect(within(row).getByText('Cambiar')).toBeVisible();
      expect(row.querySelector('button, a')).toBeNull();
    }
  }
});

it.each([
  ['B', 'Precio', 'Precio'], ['E', 'Calidad', 'Calidad · Texto'], ['F', 'Ubicación', 'Ubicación · Texto'],
])('abre y edita la columna mapeada %s y la conserva tras reapply asíncrono', async (letter, header, destination) => {
  const { onApply, value } = await setup();
  await next();
  await userEvent.click(within(screen.getByRole('button', { name: `Cambiar columna ${letter}: ${header}` })).getByText('Cambiar'));
  const article = screen.getByRole('article', { name: `Columna ${header}` });
  expect(article).toHaveFocus();
  expect(article).toHaveClass('flash');
  expect(card(header).getByRole('combobox')).toHaveTextContent(destination);
  let finish!: (result: ImportAnalysis) => void;
  onApply.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await userEvent.click(card(header).getByRole('button', { name: 'Campo existente' }));
  await userEvent.click(card(header).getByRole('combobox'));
  await userEvent.click(screen.getByRole('option', { name: 'Proveedor' }));
  expect(onApply).toHaveBeenCalledOnce();
  expect(card(header).getByRole('combobox')).toHaveTextContent('Proveedor');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  // A server recalculation replaces plan objects and normalizes the data range.
  const plan = onApply.mock.calls[0][1].map(item => ({ ...item, dataEndRow: 3, mapping: item.mapping.map(column => ({ ...column })) }));
  await act(async () => finish({ ...value, plan }));
  expect(card(header).getByRole('combobox')).toHaveTextContent('Proveedor');
  await next(); await previous();
  expect(card(header).getByRole('combobox')).toHaveTextContent('Proveedor');
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

it.each([false, true])('repite foco, scroll y resaltado temporal en la misma columna (movimiento reducido: %s)', async reducedMotion => {
  await setup({ reducedMotion }); await next();
  vi.useFakeTimers();
  const choose = () => fireEvent.click(screen.getByRole('button', { name: 'Cambiar columna A: Modelo' }));
  choose();
  let article = screen.getByRole('article', { name: 'Columna Modelo' });
  expect(article).toHaveFocus();
  expect(article).toHaveAttribute('tabindex', '-1');
  expect(article).toHaveClass('flash');
  expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'center' });
  expect(scrollIntoView.mock.contexts.at(-1)).toBe(article);
  act(() => vi.advanceTimersByTime(1600));
  expect(article).not.toHaveClass('flash');
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  scrollIntoView.mockClear();
  choose();
  article = screen.getByRole('article', { name: 'Columna Modelo' });
  expect(article).toHaveFocus();
  expect(article).toHaveClass('flash');
  expect(scrollIntoView).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(1600));
  expect(article).not.toHaveClass('flash');
});

it('acumula columnas elegidas desde Resumen junto con las pendientes iniciales', async () => {
  await setup(); await next();
  for (const name of ['Cambiar columna A: Modelo', 'Cambiar columna E: Calidad', 'Cambiar columna F: Ubicación']) {
    await userEvent.click(screen.getByRole('button', { name }));
    await next();
  }
  await previous();
  for (const header of ['Obs. interna', 'Modelo', 'Calidad', 'Ubicación']) expect(screen.getByRole('article', { name: `Columna ${header}` })).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(4);
  await previous();
  await userEvent.click(screen.getByTestId('import-adjust-open'));
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

it('repite el foco del campo obligatorio cuando su tarjeta ya está montada, sin scrollIntoView disponible', async () => {
  const plan = sheetPlan(); plan.mapping[0].field = 'ignore';
  await setup({ plan: [plan], missing: ['model'] });
  await userEvent.click(screen.getByRole('button', { name: 'Ir al campo obligatorio' }));
  const article = screen.getByRole('article', { name: 'Columna Modelo' });
  expect(article).toHaveFocus();
  act(() => { article.blur(); });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: undefined });
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Ir al campo obligatorio' }));
    expect(article).toHaveFocus();
    expect(article).toHaveClass('flash');
  } finally {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scrollIntoView });
  }
});
