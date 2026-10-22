import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis } from '../services/import-api';

function analysis(kind: 'clients' | 'sales' | 'inventory' = 'clients'): ImportAnalysis {
  return {
    source: 'heuristic', notice: null, currency: 'USD',
    rows: [kind === 'clients' ? { name: 'Lucía', phone: '2615550106' } : kind === 'sales' ? { clientName: 'Lucía', device: 'iPhone 13', amount: '420' } : { model: 'iPhone 13', price: '', currency: 'USD', condition: 'USADO', quantity: '1' }],
    plan: [{ name: 'Hoja 1', include: true, condition: '', headerRow: 1, dataStartRow: 2, dataEndRow: 2, mapping: [{ header: 'Nombre', field: 'name' }], splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD' }],
    summary: { sheetCount: 1, rowCount: 1, sheets: [{ name: 'Hoja 1', included: true, condition: '', rows: 1 }] },
  };
}

function setup(kind: 'clients' | 'sales' | 'inventory' = 'clients') {
  const result = analysis(kind);
  const onAnalyze = vi.fn(async () => result);
  const onImport = vi.fn(async (_rows: Record<string, string>[]) => ({ imported: 1, updated: 0, errors: [] }));
  const onClose = vi.fn();
  const fields = kind === 'clients' ? [{ key: 'name', label: 'Nombre', required: true }] : kind === 'sales' ? [{ key: 'amount', label: 'Precio', required: false }] : [{ key: 'model', label: 'Modelo', required: true }, { key: 'price', label: 'Precio', required: false }];
  render(<ImportModal title="Importar" fields={fields} nouns={{ one: 'fila', many: 'filas' }} onAnalyze={onAnalyze} onApply={vi.fn()} onImport={onImport} onClose={onClose} />);
  return { onAnalyze, onImport, onClose };
}

function fileInput() { return screen.getByLabelText('Archivo a importar') as HTMLInputElement; }

describe('importador compartido compacto', () => {
  it('ofrece tres modos, conserva el borrador y coloca una sola acción en el footer', async () => {
    setup();
    const modes = within(screen.getByRole('group', { name: 'Origen del listado' }));
    expect(modes.getAllByRole('button').map((button) => button.textContent)).toEqual(['CSV', 'Subir .txt', 'Pegar listado']);
    expect(modes.getByRole('button', { name: 'CSV' })).toHaveAttribute('aria-pressed', 'true');
    expect(fileInput()).toHaveAttribute('accept', '.csv,.xlsx');
    await userEvent.click(modes.getByRole('button', { name: 'Pegar listado' }));
    const primary = screen.getByRole('button', { name: 'Analizar listado' });
    expect(primary.closest('.sheet-foot')).toBeInTheDocument();
    expect(primary).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'Nombre,Teléfono\nLucía,2615550106');
    expect(primary).toBeEnabled();
    await userEvent.click(modes.getByRole('button', { name: 'Subir .txt' }));
    expect(fileInput()).toHaveAttribute('accept', '.txt,text/plain');
    await userEvent.click(modes.getByRole('button', { name: 'Pegar listado' }));
    expect(screen.getByRole('textbox')).toHaveValue('Nombre,Teléfono\nLucía,2615550106');
  });

  it.each(['clients', 'sales'] as const)('reutiliza el parser CSV para pegar y subir TXT en %s', async (kind) => {
    const { onAnalyze, onImport } = setup(kind);
    const listing = kind === 'clients' ? 'Nombre,Teléfono\nLucía,2615550106' : 'Cliente,Equipo,Precio\nLucía,iPhone 13,420';
    await userEvent.click(screen.getByRole('button', { name: 'Pegar listado' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: listing } });
    await userEvent.click(screen.getByRole('button', { name: 'Analizar listado' }));
    await screen.findByTestId('import-preview');
    const firstPayload = onAnalyze.mock.calls[0];
    expect(firstPayload).toEqual([[{ name: 'Hoja 1', rows: listing.split('\n').map((line) => line.split(',')) }]]);
    expect(onImport).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await userEvent.click(screen.getByRole('button', { name: 'Subir .txt' }));
    const file = new File([listing], 'listado.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => listing });
    await userEvent.upload(fileInput(), file);
    await screen.findByTestId('import-preview');
    expect(onAnalyze.mock.calls[1]).toEqual(firstPayload);
  });

  it('la dropzone funciona con teclado y admite archivos arrastrados', async () => {
    const { onAnalyze } = setup();
    const click = vi.spyOn(fileInput(), 'click');
    screen.getByRole('button', { name: 'Elegir archivo CSV o XLSX' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['Nombre\nLucía'], 'clientes.csv', { type: 'text/csv' });
    fireEvent.drop(screen.getByRole('button', { name: 'Elegir archivo CSV o XLSX' }), { dataTransfer: { files: [file] } });
    await screen.findByTestId('import-preview');
    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  it('no cierra durante persistencia y conserva preview y filas al fallar', async () => {
    const { onImport, onClose } = setup();
    let reject!: (reason: Error) => void;
    onImport.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    await userEvent.upload(fileInput(), new File(['Nombre\nLucía'], 'clientes.csv', { type: 'text/csv' }));
    await screen.findByTestId('import-preview');
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(screen.getByTestId('import-confirm')).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => reject(new Error('No se pudo guardar')));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByText('Lucía')).toBeInTheDocument();
    expect(screen.getByTestId('import-confirm')).toBeEnabled();
    expect(onImport).toHaveBeenCalledWith([{ name: 'Lucía', phone: '2615550106' }]);
  });

  it('cancela un análisis pendiente sin aplicar una respuesta tardía', async () => {
    const { onAnalyze } = setup();
    let resolve!: (value: ImportAnalysis) => void;
    onAnalyze.mockImplementationOnce(() => new Promise((resolvePromise) => { resolve = resolvePromise; }));
    await userEvent.upload(fileInput(), new File(['Nombre\nLucía'], 'clientes.csv', { type: 'text/csv' }));
    const loading = await screen.findByTestId('import-reading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading).toHaveTextContent('');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await act(async () => resolve(analysis()));
    expect(screen.queryByTestId('import-preview')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
  });

  it('marca campos requeridos faltantes en la fila sin cambiar el payload', async () => {
    const { onAnalyze, onImport } = setup();
    onAnalyze.mockResolvedValueOnce({ ...analysis(), rows: [{ name: '', phone: '2615550106' }] });
    await userEvent.upload(fileInput(), new File(['Nombre,Teléfono\n,2615550106'], 'clientes.csv', { type: 'text/csv' }));
    expect(await screen.findByTestId('import-preview-row')).toHaveClass('bg-red-50');
    expect(screen.getByText('Falta Nombre')).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });
});
