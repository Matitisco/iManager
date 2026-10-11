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
  it('lista todos los equipos en una tabla virtualizada', async () => {
    await openPreview(3000);
    expect(screen.getByTestId('import-preview-count')).toHaveTextContent(`${new Intl.NumberFormat('es-AR').format(3000)} equipos`);
    expect(screen.getByText('Modelo')).toBeInTheDocument();
    expect(screen.getByText('Moneda')).toBeInTheDocument();
    const preview = screen.getByTestId('import-preview');
    expect(preview.parentElement?.parentElement).toHaveAttribute('data-layout', 'table');
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

  it('en el celular muestra la lista completa como tarjetas', async () => {
    await openPreview(40, true);
    expect(screen.getByTestId('import-preview').parentElement?.parentElement).toHaveAttribute('data-layout', 'cards');
    expect(screen.getByText('Equipo 1')).toBeInTheDocument();
    expect(screen.getAllByText(/128 GB · Black · USADO · 90%/).length).toBeGreaterThan(0);
    const preview = screen.getByTestId('import-preview');
    preview.scrollTop = 72 * 40;
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
    expect(screen.queryByTestId('import-preview')).not.toBeInTheDocument();
    expect(screen.queryByText('No encontramos filas para importar. Podés ajustar el encabezado.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-confirm')).not.toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });
});
