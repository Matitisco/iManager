import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SalesImportReview } from './SalesImportReview';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis, ImportSheetPlan } from '../services/import-api';

const fields = ['date', 'clientName', 'device', 'amount', 'currency', 'paymentMethod', 'notes'].map(key => ({ key, label: key === 'notes' ? 'Notas' : key, required: false }));
const plan: ImportSheetPlan[] = [{ name: 'Ventas QA', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 301, condition: '', splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'ARS', mapping: [{ header: 'Cliente', columnIndex: 0, field: 'clientName' }, { header: 'Precio', columnIndex: 1, field: 'amount' }, { header: 'Referencia', columnIndex: 2, field: '' }] }];
const rows = Array.from({ length: 300 }, (_, index) => ({ clientName: `Persona ficticia ${index + 1}`, amount: '500000', currency: 'ARS', notes: `Referencia (origen): QA-${index}`, _sourceRow: String(index + 2), _sourceSheet: 'Ventas QA', _amountUsd: '500', _exchangeRate: '1000', _rateDate: '10/01/2024', _rateSource: 'historical', _unassigned: '1', _review: index === 0 ? 'Posible venta duplicada en el archivo\nMedio de pago por revisar\nIMEI no encontrado en stock: la venta se importa igual' : '' }));
const sheets = [{ name: 'Ventas QA', rows: [['Cliente', 'Precio', 'Referencia'], ...rows.map(row => [row.clientName, row.amount, row.notes])] }];

describe('sales row preview', () => {
  it('virtualizes the full file, retains last row and opens warnings and notes before confirmation', async () => {
    render(<SalesImportReview rows={rows} sheets={sheets} plan={plan} active={plan[0]} fields={fields} disabled={false} onSheet={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByTestId('import-preview-count')).toHaveTextContent('300 ventas');
    expect(screen.getAllByTestId('import-preview-row').length).toBeLessThan(30);
    await userEvent.click(screen.getByRole('button', { name: 'Por revisar (3)' }));
    const detail = screen.getByTestId('sales-import-row-detail');
    expect(detail).toHaveTextContent('Posible venta duplicada');
    expect(detail).toHaveTextContent('Medio de pago por revisar');
    expect(detail).toHaveTextContent('IMEI no encontrado en stock');
    expect(detail).toHaveTextContent('Referencia (origen): QA-0');
    expect(detail).toHaveTextContent('Cotización de la fecha de venta');
    const preview = screen.getByTestId('import-preview');
    fireEvent.scroll(preview, { target: { scrollTop: 64 * 290 } });
    expect(within(preview).getAllByText('Persona ficticia 300')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Por revisar (1)' }));
    expect(preview).toHaveAttribute('aria-rowcount', '1');
  });

  it('maps original columns directly, including notes, while keeping unassigned values', async () => {
    const onChange = vi.fn();
    render(<SalesImportReview rows={rows.slice(0, 1)} sheets={sheets} plan={plan} active={plan[0]} fields={fields} disabled={false} onSheet={vi.fn()} onChange={onChange} />);
    const mapping = screen.getByRole('combobox', { name: 'Importar Referencia como' });
    expect(mapping).toHaveValue('ignore');
    expect(within(mapping).getByRole('option', { name: 'Conservar en notas' })).toBeInTheDocument();
    await userEvent.selectOptions(mapping, 'notes');
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ mapping: expect.arrayContaining([expect.objectContaining({ columnIndex: 2, field: 'notes' })]) })], false);
  });

  it('keeps the preview open with the error when atomic persistence fails', async () => {
    const analysis: ImportAnalysis = { rows: rows.slice(0, 1), plan, summary: { rowCount: 1, sheetCount: 1, sheets: [{ name: 'Ventas QA', rows: 1, included: true, condition: '' }] }, currency: 'ARS', source: 'model', notice: null };
    const onImport = vi.fn().mockRejectedValue(new Error('No se pudo guardar ninguna venta'));
    render(<ImportModal title="Importar ventas" fields={fields} nouns={{ one: 'venta', many: 'ventas' }} onClose={vi.fn()} onAnalyze={vi.fn(async () => analysis)} onApply={vi.fn(async () => analysis)} onImport={onImport} />);
    await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Cliente,Precio\nPersona ficticia,500000'], 'ventas.csv', { type: 'text/csv' }));
    await screen.findByTestId('sales-import-review');
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar ninguna venta');
    expect(screen.getByTestId('sales-import-review')).toBeInTheDocument();
    expect(onImport).toHaveBeenCalledWith(rows.slice(0, 1));
  });
});
