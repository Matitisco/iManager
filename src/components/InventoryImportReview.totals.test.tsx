import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import { parseWorkbook } from '../utils/parse-workbook';
import type { ImportAnalysis } from '../services/import-api';

vi.mock('../utils/parse-workbook', () => ({ parseWorkbook: vi.fn() }));

it('highlights a possible total and confirms every preview row with its review note and status', async () => {
  const grid = [['Modelo', 'Precio'], ['iPhone 13', '100'], ['iPhone 14', '200'], ['TOTAL', '300']];
  vi.mocked(parseWorkbook).mockResolvedValue({ sheetNames: ['Stock'], getSheet: () => grid });
  const rows = grid.slice(1).map((row, index) => ({ model: row[0], price: row[1], _sourceSheet: 'Stock', _sourceRow: String(index + 2),
    ...(index === 2 ? { status: 'EN_REVISION', batteryNote: 'Parece una fila de total' } : {}) }));
  const analysis: ImportAnalysis = { source: 'heuristic', notice: null, currency: 'USD', rows,
    plan: [{ name: 'Stock', include: true, condition: '', headerRow: 1, dataStartRow: 2, dataEndRow: 4,
      mapping: [{ header: 'Modelo', columnIndex: 0, field: 'model' }, { header: 'Precio', columnIndex: 1, field: 'price' }],
      splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD' }],
    summary: { sheetCount: 1, rowCount: 3, sheets: [{ name: 'Stock', rows: 3, condition: '', included: true }] } };
  const onImport = vi.fn(async (_rows: Record<string, string>[]) => ({ imported: 3, updated: 0, errors: [] }));
  render(<ImportModal fields={[{ key: 'model', label: 'Modelo', required: true }, { key: 'price', label: 'Precio', required: false }]}
    nouns={{ one: 'equipo', many: 'equipos' }} onAnalyze={async () => analysis} onApply={async () => analysis} onImport={onImport} onClose={vi.fn()} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['fixture'], 'stock.xlsx'));
  expect(await screen.findByText('1 equipo por revisar')).toBeVisible();
  expect(screen.getByTestId('import-preview-count')).toHaveTextContent('3 equipos');
  const previewRows = screen.getAllByTestId('import-preview-row');
  expect(previewRows).toHaveLength(3);
  expect(previewRows.filter(row => row.classList.contains('imp-total-row'))).toEqual([previewRows[2]]);
  expect(within(previewRows[2]).getByText('Por revisar · Parece una fila de total')).toBeVisible();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport.mock.calls[0]?.[0]).toEqual(rows);
  expect(await screen.findByText('Importación completada')).toBeVisible();
});
