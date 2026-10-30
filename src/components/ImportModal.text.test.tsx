import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis } from '../services/import-api';
const text = '13pm 256 azul usado bat 85 520usd x3';
const analysis: ImportAnalysis = {
  source: 'model', notice: null, currency: 'ARS', plan: [],
  rows: [{ model: 'iPhone 13 Pro Max', capacity: '256GB', color: 'azul', batteryHealth: '85%', condition: 'USADO', price: '520', currency: 'USD', quantity: '3', imei: '' }],
  review: [{ line: 1, original: text, dudas: ['Revisá la cantidad.'] }],
  discarded: [{ line: 2, original: 'gracias gente', reason: 'Comentario' }],
  summary: { sheetCount: 1, rowCount: 1, sheets: [{ name: 'Listado', rows: 1, condition: '', included: true }] },
};
const fields = ['model', 'capacity', 'color', 'batteryHealth', 'price', 'cost', 'imei', 'condition'].map((key) => ({ key, label: ({ model: 'Modelo', price: 'Precio', condition: 'Condición' } as Record<string, string>)[key] ?? key, required: key === 'model' }));
function setup(sheet = false, result = analysis) {
  const onAnalyzeText = vi.fn(async () => result);
  const onImport = vi.fn(async (_rows: Record<string, string>[]) => ({ imported: 1, updated: 0, errors: [] }));
  render(<ImportModal fields={fields} sheet={sheet} onAnalyzeText={onAnalyzeText} onAnalyze={vi.fn()} onApply={vi.fn()} onImport={onImport} onClose={vi.fn()} nouns={{ one: 'equipo', many: 'equipos' }} />);
  return { onAnalyzeText, onImport };
}
async function paste() {
  await userEvent.click(screen.getByRole('button', { name: 'Pegar listado' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Listado de equipos' }), text);
  await userEvent.click(screen.getByRole('button', { name: 'Analizar listado' }));
  await screen.findByTestId('import-preview');
}
describe('text import shares Excel review', () => {
  it.each([false, true])('requires explicit confirmation and allows correction (%s mobile)', async (sheet) => {
    const { onAnalyzeText, onImport } = setup(sheet);
    await paste();
    expect(onAnalyzeText).toHaveBeenCalledWith(text);
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-preview-row')).toHaveClass('bg-amber-50');
    expect(screen.getByTestId('import-preview')).toHaveTextContent('USD');
    await userEvent.click(screen.getByTestId('import-edit-row-0'));
    expect(screen.getByText('Revisá la cantidad.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Precio' }), { target: { value: '530' } });
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0]).toHaveLength(1);
    expect(onImport.mock.calls[0][0][0]).toMatchObject({ price: '530', currency: 'USD', quantity: '3' });
  });
  it('sends identical txt content to the same analyzer', async () => {
    const { onAnalyzeText } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Subir .txt' }));
    const file = new File([text], 'stock.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => text });
    await userEvent.upload(document.querySelector('input[type=file]') as HTMLInputElement, file);
    await screen.findByTestId('import-preview');
    expect(onAnalyzeText).toHaveBeenCalledWith(text);
  });
  it('shows discarded reasons and excludes a row before import', async () => {
    const { onImport } = setup(); await paste();
    expect(screen.getByTestId('import-discarded')).toHaveTextContent('Comentario');
    await userEvent.click(screen.getByTestId('import-edit-row-0'));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir fila' }));
    expect(screen.getByTestId('import-confirm')).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar filas' }));
    expect(screen.getByTestId('import-confirm')).toBeEnabled();
  });
  it('shows unrelated text clearly and offers no confirm', async () => {
    setup(false, { ...analysis, rows: [], review: [], notice: 'Este texto no parece tener equipos para importar' });
    await userEvent.click(screen.getByRole('button', { name: 'Pegar listado' }));
    await userEvent.type(screen.getByRole('textbox'), 'Hola');
    await userEvent.click(screen.getByRole('button', { name: 'Analizar listado' }));
    expect(await screen.findByTestId('import-unrelated')).toHaveTextContent('Este texto no parece tener equipos para importar');
    expect(screen.queryByTestId('import-confirm')).not.toBeInTheDocument();
  });
  it('keeps preview and typed data when persistence or LLM fails', async () => {
    const { onImport } = setup(); await paste();
    onImport.mockRejectedValueOnce(new Error('No se pudo guardar'));
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByTestId('import-preview')).toBeVisible();
  });
});

describe('errores visibles en filas de texto', () => {
  it.each([false, true])('marca la fila inválida y permite corregirla antes de importar (mobile: %s)', async (sheet) => {
    const { onImport } = setup(sheet, { ...analysis, rows: [{ ...analysis.rows[0], price: 'inválido' }], review: [{ ...analysis.review![0], dudas: [] }] });
    await paste();
    expect(screen.getByTestId('import-preview-row')).toHaveClass('bg-red-50');
    expect(screen.getByTestId('import-preview-row')).toHaveTextContent('Completá un precio válido');
    expect(screen.getByTestId('import-confirm')).toBeDisabled();
    await userEvent.click(screen.getByTestId('import-edit-row-0'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Precio' }), { target: { value: '420' } });
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.getByTestId('import-preview-row')).not.toHaveClass('bg-red-50');
    expect(screen.getByTestId('import-confirm')).toBeEnabled();
    expect(onImport).not.toHaveBeenCalled();
  });
});
