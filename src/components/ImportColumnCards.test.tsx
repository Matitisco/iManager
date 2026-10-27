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

it.each(['text', 'date', 'number'] as const)('crea un campo %s con nombre validado y conserva tres muestras', async type => {
  const onDraft = vi.fn(); const onChange = vi.fn();
  render(<ImportColumnCards active={active} visibleColumns={new Set([1])} rows={[["iPhone 13", "uno"], ["iPhone 14", "dos"], ["iPhone 15", "tres"]]}
    fields={[{ key: 'model', label: 'Modelo', required: true }]}
    definitions={[{ id: 'existing', entity: 'inventory', key: 'existing', label: 'Ya existe', type: 'text', order: 0 }]}
    drafts={[{ entity: 'inventory', key: 'draft', label: 'Borrador', type: 'text', order: 1 }]}
    onDraft={onDraft} onChange={onChange} disabled={false} />);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  const card = within(screen.getByRole('article', { name: 'Columna B' }));
  for (const value of ['uno', 'dos', 'tres']) expect(card.getByText(value)).toBeVisible();
  await userEvent.click(card.getByRole('button', { name: 'Nuevo campo' }));
  const modal = within(screen.getByRole('dialog', { name: 'Nuevo campo' }));
  await userEvent.click(modal.getByRole('button', { name: 'Crear campo' }));
  expect(modal.getByText('Ingresá un nombre')).toBeVisible();
  for (const duplicate of ['ya EXISTE', 'borrador']) {
    await userEvent.clear(modal.getByRole('textbox'));
    await userEvent.type(modal.getByRole('textbox'), duplicate);
    await userEvent.click(modal.getByRole('button', { name: 'Crear campo' }));
    expect(modal.getByText('Ya existe un campo con ese nombre')).toBeVisible();
    expect(onDraft).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  }
  await userEvent.clear(modal.getByRole('textbox'));
  await userEvent.type(modal.getByRole('textbox'), 'Reparaciones');
  await userEvent.click(modal.getByRole('button', { name: type === 'text' ? 'Texto' : type === 'date' ? 'Fecha' : 'Número' }));
  await userEvent.click(modal.getByRole('button', { name: 'Crear campo' }));
  expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ label: 'Reparaciones', type }));
  expect(onChange.mock.calls[0][0].mapping[1].field).toBe(`custom:${onDraft.mock.calls[0][0].key}`);
});
