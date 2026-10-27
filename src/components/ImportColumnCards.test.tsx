import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ImportColumnCards } from './ImportColumnCards';
import type { ImportSheetPlan } from '../services/import-api';
const active: ImportSheetPlan = { name: 'Stock', include: true, headerRow: 0, dataStartRow: 1, dataEndRow: 3, condition: '', mapping: [{ header: 'A', columnIndex: 0, field: 'model' }, { header: 'B', columnIndex: 1, field: 'ignore' }], splitModelCapacity: false, batteryAsPercent: false, priceCurrency: '' };
it('renders each physical column with three examples and creates only a draft', async () => {
  const onDraft = vi.fn(); const onChange = vi.fn();
  render(<ImportColumnCards active={active} rows={[["iPhone 13", "1"], ["iPhone 14", "2"], ["iPhone 15", "0"]]} fields={[{ key: 'model', label: 'Modelo', required: true }]} definitions={[]} drafts={[]} onDraft={onDraft} onChange={onChange} disabled={false} />);
  const card = screen.getByRole('article', { name: 'Columna B' });
  expect(within(card).getByText('0')).toBeVisible();
  await userEvent.click(within(card).getByRole('button', { name: 'Nuevo campo' }));
  const modal = screen.getByRole('dialog', { name: 'Nuevo campo' });
  await userEvent.type(within(modal).getByRole('textbox'), 'Reparaciones');
  await userEvent.click(within(modal).getByRole('button', { name: 'Número' }));
  await userEvent.click(within(modal).getByRole('button', { name: 'Crear campo' }));
  expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ label: 'Reparaciones', type: 'number' }));
  const draft = onDraft.mock.calls[0][0];
  expect(onChange.mock.calls[0][0].mapping[1]).toMatchObject({ columnIndex: 1, field: `custom:${draft.key}` });
});
it('canceling a new field leaves the mapping and definitions untouched', async () => {
  const onDraft = vi.fn(); const onChange = vi.fn();
  render(<ImportColumnCards active={active} rows={[["iPhone 13", "1"]]} fields={[{ key: 'model', label: 'Modelo', required: true }]} definitions={[]} drafts={[]} onDraft={onDraft} onChange={onChange} disabled={false} />);
  await userEvent.click(within(screen.getByRole('article', { name: 'Columna B' })).getByRole('button', { name: 'Nuevo campo' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Nuevo campo' })).getByRole('button', { name: 'Cancelar' }));
  expect(onDraft).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
});
