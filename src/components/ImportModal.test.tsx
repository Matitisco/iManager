import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis } from '../services/import-api';

const fields = [
  { key: 'model', label: 'Modelo', required: true },
  { key: 'capacity', label: 'Capacidad', required: false },
  { key: 'color', label: 'Color', required: false },
  { key: 'condition', label: 'Condición', required: false },
  { key: 'batteryHealth', label: 'Batería', required: false },
  { key: 'price', label: 'Precio', required: false },
];

function analysis(count: number): ImportAnalysis {
  const rows = Array.from({ length: count }, (_, index) => ({
    model: index === count - 1 ? 'ZZ-ULTIMO' : `Equipo ${index + 1}`,
    capacity: '128 GB',
    color: 'Black',
    condition: 'USADO',
    batteryHealth: '90%',
    price: String(100 + index),
  }));
  return {
    source: 'model',
    notice: null,
    currency: 'USD',
    plan: [{
      name: 'Hoja 1',
      include: true,
      condition: 'USADO',
      headerRow: 1,
      dataStartRow: 2,
      dataEndRow: count + 1,
      mapping: [{ header: 'Modelo', field: 'model' }, { header: 'Precio', field: 'price' }],
      splitModelCapacity: false,
      batteryAsPercent: false,
      priceCurrency: 'USD',
    }],
    rows,
    summary: {
      sheetCount: 1,
      rowCount: count,
      sheets: [{ name: 'Hoja 1', rows: count, condition: 'USADO', included: true }],
    },
  };
}

async function openPreview(count: number, sheet = false) {
  const onAnalyze = vi.fn(async () => analysis(count));
  render(
    <ImportModal
      title="Importar equipos"
      fields={fields}
      nouns={{ one: 'equipo', many: 'equipos' }}
      sheet={sheet}
      onClose={vi.fn()}
      onAnalyze={onAnalyze}
      onApply={vi.fn(async () => analysis(count))}
      onImport={vi.fn(async () => ({ imported: count, updated: 0, errors: [] }))}
    />,
  );
  const file = new File(['Modelo,Precio\n13,100\n'], 'stock.csv', { type: 'text/csv' });
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('falta el input');
  await userEvent.upload(input, file);
  await screen.findByTestId('import-preview-count');
  return onAnalyze;
}

describe('previsualización de importación', () => {
  it('lista todos los equipos en tabla virtualizada', async () => {
    await openPreview(3000);
    expect(screen.getByTestId('import-preview-count')).toHaveTextContent(`${new Intl.NumberFormat('es-AR').format(3000)} equipos`);
    const preview = screen.getByTestId('import-preview');
    expect(preview.querySelector('table')).toBeInTheDocument();
    const rendered = preview.querySelectorAll('[data-testid="import-preview-row"]');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(80);
    expect(screen.getByText('Equipo 1')).toBeInTheDocument();
    expect(screen.queryByText('ZZ-ULTIMO')).not.toBeInTheDocument();

    preview.scrollTop = 44 * 2990;
    fireEvent.scroll(preview);
    expect(screen.getByText('ZZ-ULTIMO')).toBeInTheDocument();
    expect(preview.querySelectorAll('[data-testid="import-preview-row"]').length).toBeLessThan(80);
  });

  it('en el celular conserva la tabla horizontal y el selector desde el encabezado', async () => {
    await openPreview(40, true);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByText('Equipo 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar Modelo como' })).toBeVisible();
    const preview = screen.getByTestId('import-preview');
    preview.scrollTop = 44 * 40;
    fireEvent.scroll(preview);
    expect(screen.getByText('ZZ-ULTIMO')).toBeInTheDocument();
  });

  it('acepta el fixture de miles de filas y rechaza por encima del máximo', async () => {
    const onAnalyze = vi.fn(async () => analysis(1));
    render(
      <ImportModal
        title="Importar equipos"
        fields={fields}
        nouns={{ one: 'equipo', many: 'equipos' }}
        onClose={vi.fn()}
        onAnalyze={onAnalyze}
        onApply={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('falta el input');
    const allowed = new File(
      [`Modelo,Precio\n${Array.from({ length: 3000 }, (_, index) => `M${index},10`).join('\n')}\n`],
      'miles.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(input, allowed);
    await waitFor(() => expect(onAnalyze).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));

    const blocked = new File(
      [`Modelo,Precio\n${Array.from({ length: 5001 }, (_, index) => `M${index},10`).join('\n')}\n`],
      'demasiadas.csv',
      { type: 'text/csv' },
    );
    const again = document.querySelector('input[type="file"]');
    if (!(again instanceof HTMLInputElement)) throw new Error('falta el input');
    await userEvent.upload(again, blocked);
    expect(await screen.findByText('El archivo supera las 5000 filas.')).toBeInTheDocument();
  });

  it.each([
    ['desktop', false],
    ['mobile', true],
  ])('en %s no importa un archivo sin equipos y lo dice', async (_label, sheet) => {
    const onImport = vi.fn();
    render(
      <ImportModal
        title="Importar equipos"
        fields={fields}
        nouns={{ one: 'equipo', many: 'equipos' }}
        sheet={sheet}
        onClose={vi.fn()}
        onAnalyze={vi.fn(async () => ({
          ...analysis(0),
          notice: 'Este archivo no parece tener equipos para importar.',
          summary: { sheetCount: 0, rowCount: 0, sheets: [] },
        }))}
        onApply={vi.fn()}
        onImport={onImport}
      />,
    );
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('falta el input');
    await userEvent.upload(input, new File(['Nombre,Nota\nAna,8\n'], 'alumnos.csv', { type: 'text/csv' }));
    expect(await screen.findByTestId('import-unrelated')).toHaveTextContent('Este archivo no parece tener equipos para importar.');
    expect(screen.queryAllByTestId('import-preview-row')).toHaveLength(0);
    expect(screen.queryByText('No encontramos filas para importar. Podés ajustar el encabezado.')).not.toBeInTheDocument();
    expect(screen.getByTestId('import-confirm')).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });
});

const saleFields = [
  { key: 'date', label: 'Fecha', required: false },
  { key: 'clientName', label: 'Cliente', required: false },
  { key: 'device', label: 'Equipo', required: false },
  { key: 'amount', label: 'Precio', required: false },
  { key: 'currency', label: 'Moneda', required: false },
  { key: 'paymentMethod', label: 'Pago', required: false },
  { key: 'tradeIn', label: 'Canje', required: false },
  { key: 'seller', label: 'Vendedor', required: false },
];

const clientFields = [
  { key: 'name', label: 'Nombre', required: true },
  { key: 'phone', label: 'Teléfono', required: false },
  { key: 'instagram', label: 'Instagram', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'dni', label: 'DNI', required: false },
];

function sectionAnalysis(kind: 'sales' | 'clients', count: number): ImportAnalysis {
  const rows = Array.from({ length: count }, (_, index) => kind === 'sales'
    ? {
      date: '03/10/2026',
      clientName: index === count - 1 ? 'ZZ-ULTIMO' : `Cliente ${index + 1}`,
      device: 'iPhone 13 128 GB',
      productImei: '350000000000101',
      amount: '850000',
      currency: 'ARS',
      paymentMethod: 'TRANSFERENCIA',
      tradeIn: 'iPhone 11',
      seller: 'Martín',
    }
    : {
      name: index === count - 1 ? 'ZZ-ULTIMO' : `Cliente ${index + 1}`,
      phone: '+5491155551234',
      instagram: 'lucia.iphone',
      email: 'lucia@gmail.com',
      dni: '30111222',
    });
  return {
    source: 'model',
    notice: null,
    currency: 'ARS',
    plan: [{
      name: 'Hoja 1',
      include: true,
      condition: '',
      headerRow: 1,
      dataStartRow: 2,
      dataEndRow: count + 1,
      mapping: [],
      splitModelCapacity: false,
      batteryAsPercent: false,
      priceCurrency: '',
    }],
    rows,
    summary: {
      sheetCount: 1,
      rowCount: count,
      sheets: [{ name: 'Hoja 1', rows: count, condition: '', included: true }],
    },
  };
}

describe('previsualización de ventas y clientes', () => {
  it.each([
    ['ventas', 'sales', saleFields, { one: 'venta', many: 'ventas' }, 'Ventas a importar', 'Cliente 1'],
    ['clientes', 'clients', clientFields, { one: 'cliente', many: 'clientes' }, 'Clientes a importar', 'Cliente 1'],
  ] as const)('lista %s en tabla virtualizada y en tarjetas', async (_label, kind, fieldsForKind, nouns, heading, first) => {
    const onAnalyze = vi.fn(async () => sectionAnalysis(kind, 80));
    const { unmount } = render(
      <ImportModal
        title={kind === 'sales' ? 'Importar ventas' : 'Importar clientes'}
        fields={[...fieldsForKind]}
        nouns={nouns}
        onClose={vi.fn()}
        onAnalyze={onAnalyze}
        onApply={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('falta el input');
    await userEvent.upload(input, new File(['a,b\n1,2\n'], 'planilla.csv', { type: 'text/csv' }));
    expect(await screen.findByTestId('import-preview-count')).toHaveTextContent(`80 ${nouns.many}`);
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(screen.getByText(first)).toBeInTheDocument();
    const preview = screen.getByTestId('import-preview');
    expect(preview.querySelectorAll('[data-testid="import-preview-row"]').length).toBeLessThan(40);
    preview.scrollTop = 72 * 79;
    fireEvent.scroll(preview);
    expect(screen.getByText('ZZ-ULTIMO')).toBeInTheDocument();
    unmount();

    render(
      <ImportModal
        title={kind === 'sales' ? 'Importar ventas' : 'Importar clientes'}
        fields={[...fieldsForKind]}
        nouns={nouns}
        sheet
        onClose={vi.fn()}
        onAnalyze={onAnalyze}
        onApply={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const phoneInput = document.querySelector('input[type="file"]');
    if (!(phoneInput instanceof HTMLInputElement)) throw new Error('falta el input');
    await userEvent.upload(phoneInput, new File(['a,b\n1,2\n'], 'planilla.csv', { type: 'text/csv' }));
    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(screen.getByTestId('import-preview').parentElement?.parentElement).toHaveAttribute('data-layout', 'cards');
  });

  it.each([
    ['ventas', 'Este archivo no parece tener ventas para importar.', saleFields, { one: 'venta', many: 'ventas' }],
    ['clientes', 'Este archivo no parece tener clientes para importar.', clientFields, { one: 'cliente', many: 'clientes' }],
  ] as const)('dice cuando el archivo no tiene %s', async (_label, notice, fieldsForKind, nouns) => {
    render(
      <ImportModal
        title="Importar"
        fields={[...fieldsForKind]}
        nouns={nouns}
        unrelatedNotice={notice}
        onClose={vi.fn()}
        onAnalyze={vi.fn(async () => ({
          ...sectionAnalysis('clients', 0),
          notice,
          rows: [],
          summary: { sheetCount: 0, rowCount: 0, sheets: [] },
        }))}
        onApply={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('falta el input');
    await userEvent.upload(input, new File(['Alumno,Nota\nAna,8\n'], 'otro.csv', { type: 'text/csv' }));
    expect(await screen.findByTestId('import-unrelated')).toHaveTextContent(notice);
    expect(screen.queryByTestId('import-confirm')).not.toBeInTheDocument();
  });
});

function renderImporter(sheet: boolean) {
  const onClose = vi.fn();
  render(
    <ImportModal
      title="Importar equipos"
      fields={fields}
      nouns={{ one: 'equipo', many: 'equipos' }}
      sheet={sheet}
      onClose={onClose}
      onAnalyze={vi.fn()}
      onApply={vi.fn()}
      onImport={vi.fn()}
    />,
  );
  return onClose;
}

describe('cierre del importador con Escape', () => {
  it('cierra el modal de escritorio y no reacciona a otras teclas', async () => {
    const onClose = renderImporter(false);
    expect(screen.getByRole('dialog', { name: 'Importar equipos' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra la hoja del celular una sola vez', async () => {
    const onClose = renderImporter(true);
    expect(screen.getByRole('dialog', { name: 'Importar equipos' })).toHaveClass('sheet');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sigue cerrando el modal de escritorio con un clic afuera', () => {
    const onClose = renderImporter(false);
    const dialog = screen.getByRole('dialog', { name: 'Importar equipos' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });
});


it.each([false, true])('adds suggested origin quality drafts once and reuses existing definitions: %s', async exists => {
  const definition = { entity: 'inventory' as const, key: 'calidad_origen', label: 'Calidad (origen)', type: 'text' as const, order: 0 };
  const result = analysis(1);
  result.suggestedDefinitions = [definition, definition];
  result.rows[0]['custom:calidad_origen'] = 'A/A-';
  result.rows[0]._sourceRow = '38';
  result.plan[0].mapping.push({ header: 'Calidad', columnIndex: 2, field: 'custom:calidad_origen' });
  result.diagnostics = { detectedRows: 2, acceptedRows: 1, discardedRows: 1, discardedByReason: { duplicate: 1 }, missingRequiredFields: [], missingRecommendedFields: [],
    rejected: [{ row: 59, reason: 'duplicate', message: 'IMEI repetido en el archivo (igual a la fila 38)' }] };
  const onImport = vi.fn(async () => ({ imported: 1, updated: 0, errors: [] }));
  render(<ImportModal fields={fields} nouns={{ one: 'equipo', many: 'equipos' }} onClose={vi.fn()}
    customFieldDefinitions={exists ? [{ ...definition, id: 'existing' }] : []}
    onAnalyze={vi.fn(async () => result)} onApply={vi.fn(async () => result)} onImport={onImport} />);
  await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement,
    new File(['Modelo,Precio,Calidad\niPhone 13,100,A/A-'], 'synthetic.csv', { type: 'text/csv' }));
  await userEvent.click(await screen.findByTestId('import-skipped-notice'));
  const detail = screen.getByRole('dialog', { name: 'Filas descartadas' });
  expect(detail).toHaveTextContent('Duplicadas1 filaFilas: 59');
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: /Importar 1 equipo/ }));
  await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
  const call = onImport.mock.calls[0] as unknown as [Record<string, string>[], unknown?];
  expect(call[0][0]).toMatchObject({ 'custom:calidad_origen': 'A/A-', _sourceRow: '38' });
  expect(call[1]).toEqual(exists ? undefined : [definition]);
});

it('recorre un archivo CSV real, asigna Precio en vivo y confirma las filas preparadas', async () => {
  const { applyImportPlan } = await import('../services/import-api');
  const request = vi.spyOn(await import('../services/fetch-with-timeout'), 'fetchWithTimeout');
  const result = analysis(1);
  result.rows = [{ model: 'iPhone 13', price: '420', currency: 'USD', _sourceRow: '2', _sourceSheet: 'Hoja 1' }];
  result.plan[0].mapping = [{ header: 'Modelo', columnIndex: 0, field: 'model' }, { header: 'Valor', columnIndex: 1, field: 'price' }];
  const initial = { ...result, rows: [{ ...result.rows[0], price: '' }], plan: result.plan.map(plan => ({ ...plan, mapping: plan.mapping.map(column => column.field === 'price' ? { ...column, field: 'ignore' } : column) })) };
  const account = { uid: 'fixture', email: null, displayName: null, getIdToken: vi.fn(async () => 'fixture-token') };
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = 'https://fixture.invalid';
  request.mockResolvedValue(new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const onImport = vi.fn(async (_rows: Record<string, string>[]) => ({ imported: 1, updated: 0, errors: [] }));
  const onAnalyze = vi.fn(async () => initial);
  render(<ImportModal fields={fields} onAnalyze={onAnalyze} onApply={(sheets, plan, refresh) => applyImportPlan(account, 'inventory', sheets, plan, refresh)} onImport={onImport} onClose={vi.fn()} />);
  try {
    await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Modelo,Valor\niPhone 13,420\n'], 'stock-prueba.csv', { type: 'text/csv' }));
    await waitFor(() => expect(onAnalyze).toHaveBeenCalledWith([{ name: 'Hoja 1', rows: [['Modelo', 'Valor'], ['iPhone 13', '420']] }]));
    await userEvent.click(await screen.findByRole('button', { name: 'Importar Valor como' }));
    await userEvent.click(screen.getByRole('button', { name: 'Precio' }));
    await waitFor(() => expect(screen.getByTestId('import-confirm')).toBeEnabled());
    expect(request).toHaveBeenCalledWith('https://fixture.invalid/api/import/apply', expect.objectContaining({ method: 'POST', body: JSON.stringify({ section: 'inventory', sheets: [{ name: 'Hoja 1', rows: [['Modelo', 'Valor'], ['iPhone 13', '420']] }], plan: result.plan, refreshMapping: false }) }), 45_000);
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(onImport).toHaveBeenCalledWith(result.rows);
    expect(await screen.findByText('Importación completada')).toBeVisible();
  } finally {
    request.mockRestore();
    delete (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__;
  }
});
