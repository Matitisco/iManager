import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis } from '../services/import-api';

const fields = [{ key: 'model', label: 'Modelo', required: true }, { key: 'price', label: 'Precio', required: false }];
function analysis(model = true): ImportAnalysis {
  return { source: 'heuristic', currency: 'USD', notice: null,
    rows: model ? [{ model: 'iPhone 13' }] : [],
    plan: [{ name: 'Hoja 1', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 2, condition: '', mapping: model ? [{ header: 'Modelo', field: 'model' }] : [], splitModelCapacity: false, batteryAsPercent: false, priceCurrency: '' }],
    summary: { sheetCount: 1, rowCount: model ? 1 : 0, sheets: [] } };
}
async function preview(model = true) {
  const filter = vi.fn();
  const onImport = vi.fn().mockResolvedValue({ imported: 1, updated: 0, errors: [], priceToDefine: 1 });
  render(<ImportModal fields={fields} onClose={vi.fn()} onFilterPriceToDefine={filter} onAnalyze={vi.fn().mockResolvedValue(analysis(model))} onApply={vi.fn().mockResolvedValue(analysis(model))} onImport={onImport} />);
  await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Modelo,Costo\niPhone 13,420'], 'sin-precio.csv', { type: 'text/csv' }));
  await screen.findByTestId('import-price-notice');
  return { filter, onImport };
}
afterEach(() => history.replaceState(null, '', '/'));
it.each(['a', 'b'])('variante %s: importa sin precio y ofrece el filtro del resultado', async variant => {
  history.replaceState(null, '', `/?importVariant=${variant}`);
  const { filter, onImport } = await preview();
  expect(screen.getByText('A definir')).toBeVisible();
  await userEvent.click(screen.getByTestId('import-confirm'));
  expect(onImport).toHaveBeenCalledWith([{ model: 'iPhone 13' }]);
  expect(await screen.findByTestId('import-price-result')).toHaveTextContent('1 equipo quedó con precio a definir');
  await userEvent.click(screen.getByRole('button', { name: 'Ver equipos con precio a definir' }));
  expect(filter).toHaveBeenCalledOnce();
});
it('el acceso directo enfoca Precio sin convertirlo en obligatorio', async () => {
  await preview();
  await userEvent.click(screen.getByRole('button', { name: 'Asignar columna de precio' }));
  const select = screen.getByTestId('import-field-price');
  await waitFor(() => expect(select).toHaveFocus());
  expect(select).not.toHaveAttribute('aria-invalid', 'true');
});
it.each(['a', 'b'])('variante %s: resalta Modelo sin mapear y bloquea cero filas', async variant => {
  history.replaceState(null, '', `/?importVariant=${variant}`);
  await preview(false);
  expect(screen.getByTestId('import-confirm')).toBeDisabled();
  await userEvent.click(screen.getByTestId('import-adjust-open'));
  expect(screen.getByText('Obligatorio sin asignar')).toBeVisible();
  expect(screen.getByTestId('import-field-model')).toHaveAttribute('aria-invalid', 'true');
});
