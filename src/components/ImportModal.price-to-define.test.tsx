import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis } from '../services/import-api';

const fields = [{ key: 'model', label: 'Modelo', required: true }, { key: 'price', label: 'Precio', required: false }];
function analysis(model = true): ImportAnalysis {
  return { source: 'heuristic', currency: 'USD', notice: null,
    rows: model ? [{ model: 'iPhone 13' }] : [],
    plan: [{ name: 'Hoja 1', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 2, condition: '', mapping: model ? [{ header: 'Modelo', field: 'model' }] : [], splitModelCapacity: false, batteryAsPercent: false, priceCurrency: '' }],
    summary: { sheetCount: 1, rowCount: model ? 1 : 0, sheets: [] } };
}
async function preview(model = true, overrides: Partial<ImportAnalysis> = {}) {
  const filter = vi.fn();
  const onImport = vi.fn().mockResolvedValue({ imported: 1, updated: 0, errors: [], priceToDefine: 1 });
  const value = { ...analysis(model), ...overrides };
  render(<ImportModal fields={fields} onClose={vi.fn()} onFilterPriceToDefine={filter} onAnalyze={vi.fn().mockResolvedValue(value)} onApply={vi.fn().mockResolvedValue(value)} onImport={onImport} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Modelo,Costo\niPhone 13,420'], 'sin-precio.csv', { type: 'text/csv' }));
  await screen.findByTestId('import-price-notice');
  return { filter, onImport };
}
it('importa sin precio y ofrece el filtro del resultado', async () => {
  const { filter, onImport } = await preview(true, {
    diagnostics: { detectedRows: 1, acceptedRows: 1, discardedRows: 0, discardedByReason: {}, missingRequiredFields: [], missingRecommendedFields: ['price', 'imei'] },
    missingRequiredFields: [], missingRecommendedFields: ['price', 'imei'],
  });
  expect(screen.getByText('A definir')).toBeVisible();
  expect(screen.queryByTestId('import-skipped-notice')).not.toBeInTheDocument();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport).toHaveBeenCalledWith([{ model: 'iPhone 13' }]);
  expect(await screen.findByTestId('import-price-result')).toHaveTextContent('1 equipo quedó con precio a definir');
  await userEvent.click(screen.getByRole('button', { name: 'Ver equipos con precio a definir' }));
  expect(filter).toHaveBeenCalledOnce();
});

it('conserva motivos reales junto al precio a definir y al resultado', async () => {
  const { onImport } = await preview(true, {
    diagnostics: { detectedRows: 4, acceptedRows: 1, discardedRows: 3, discardedByReason: { missing_model: 1, section_header: 1, invalid_price: 1 }, missingRequiredFields: [], missingRecommendedFields: ['price', 'imei'] },
  });
  expect(screen.getByTestId('import-skipped-notice')).toHaveTextContent('3 filas descartadas');
  expect(screen.getByTestId('import-skipped-notice')).toHaveTextContent('Sin modelo: 1');
  expect(screen.getByTestId('import-skipped-notice')).toHaveTextContent('Encabezados de sección: 1');
  expect(screen.getByTestId('import-skipped-notice')).toHaveTextContent('Precio inválido: 1');
  expect(screen.getByTestId('import-confirm')).toBeEnabled();
  onImport.mockResolvedValue({ imported: 1, updated: 0, errors: [], priceToDefine: 1,
    diagnostics: { detectedRows: 2, acceptedRows: 1, discardedRows: 1, discardedByReason: { invalid_imei: 1 }, missingRequiredFields: [], missingRecommendedFields: [] } });
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(await screen.findByTestId('import-price-result')).toHaveTextContent('1 equipo quedó con precio a definir');
  expect(screen.getByTestId('import-skipped-notice')).toHaveTextContent('IMEI inválido: 1');
  expect(screen.getByTestId('import-skipped-notice')).not.toHaveTextContent('Sin modelo');
});

it('usa missingRequiredFields del backend para bloquear y resaltar', async () => {
  const value = { ...analysis(), plan: analysis().plan.map(plan => ({ ...plan, mapping: [] })),
    missingRequiredFields: ['amount'], diagnostics: { detectedRows: 1, acceptedRows: 0, discardedRows: 1, discardedByReason: { invalid_price: 1 }, missingRequiredFields: ['amount'], missingRecommendedFields: [] } };
  render(<ImportModal fields={[{ key: 'amount', label: 'Precio', required: false }]} onClose={vi.fn()} onAnalyze={vi.fn().mockResolvedValue(value)} onApply={vi.fn()} onImport={vi.fn()} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Cliente,Equipo\nAna,iPhone 13'], 'ventas.csv', { type: 'text/csv' }));
  expect(await screen.findByTestId('import-confirm')).toBeDisabled();
  await userEvent.click(screen.getByTestId('import-adjust-open'));
  expect(screen.getByTestId('import-field-amount')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('Obligatorio sin asignar')).toBeVisible();
});
it('el acceso directo enfoca Precio sin convertirlo en obligatorio', async () => {
  await preview();
  await userEvent.click(screen.getByRole('button', { name: 'Asignar columna de precio' }));
  const select = screen.getByTestId('import-field-price');
  await waitFor(() => expect(select).toHaveFocus());
  expect(select).not.toHaveAttribute('aria-invalid', 'true');
});
it('resalta Modelo sin mapear y bloquea cero filas', async () => {
  await preview(false);
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  await userEvent.click(screen.getByTestId('import-adjust-open'));
  expect(screen.getByText('Obligatorio sin asignar')).toBeVisible();
  expect(screen.getByTestId('import-field-model')).toHaveAttribute('aria-invalid', 'true');
});

it.each([1, 3])('integra el motivo y el acceso a Modelo con %i filas descartadas y cero importables', async (count) => {
  const { onImport } = await preview(false, {
    diagnostics: { detectedRows: count, acceptedRows: 0, discardedRows: count, discardedByReason: { missing_model: count }, missingRequiredFields: ['model'], missingRecommendedFields: ['price'] },
  });
  const notice = screen.getByTestId('import-skipped-notice');
  expect(within(notice).getByText(`${count} ${count === 1 ? 'fila descartada' : 'filas descartadas'} por falta de modelo.`)).toBeVisible();
  expect(within(notice).queryByRole('list')).not.toBeInTheDocument();
  expect(screen.queryByText(/Falta mapear/)).not.toBeInTheDocument();
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport).not.toHaveBeenCalled();
  await userEvent.click(within(notice).getByRole('button', { name: 'Asignar columna de modelo' }));
  const model = screen.getByTestId('import-field-model');
  await waitFor(() => expect(model).toHaveFocus());
  expect(model).toHaveAttribute('aria-invalid', 'true');
  expect(model.closest('tr')).toHaveClass('import-field-missing');
  expect(screen.getByText('Obligatorio sin asignar')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.queryByText(/Falta mapear/)).not.toBeInTheDocument();
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
});

it('conserva todos los motivos y el enlace dentro del aviso con cero filas', async () => {
  await preview(false, {
    diagnostics: { detectedRows: 3, acceptedRows: 0, discardedRows: 3, discardedByReason: { missing_model: 1, section_header: 1, invalid_price: 1 }, missingRequiredFields: ['model'], missingRecommendedFields: ['price'] },
  });
  const notice = within(screen.getByTestId('import-skipped-notice'));
  expect(notice.getAllByRole('listitem').map(item => item.textContent)).toEqual([
    'Encabezados de sección: 1', 'Sin modelo: 1', 'Precio inválido: 1',
  ]);
  expect(notice.getByRole('button', { name: 'Asignar columna de modelo' })).toBeVisible();
  expect(screen.queryByText(/Falta mapear/)).not.toBeInTheDocument();
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
});

it('conserva el error de mapeo cuando hay filas para revisar', async () => {
  await preview(true, { missingRequiredFields: ['model'] });
  expect(screen.getByText('Falta mapear Modelo.')).toBeVisible();
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
});
