import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ExpenseView } from '../../services/expenses-api';
import { ExpenseForm } from './expense';
import { DeskProvider } from '../ui';

const mocks = vi.hoisted(() => ({ save: vi.fn(), archive: vi.fn(), toast: vi.fn(), close: vi.fn(), expenses: [] as ExpenseView[] }));
vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ expenses: mocks.expenses, saveExpense: mocks.save, archiveExpense: mocks.archive }),
}));
vi.mock('../exchange', () => ({
  useMoney: () => ({ active: 'ARS', rate: 1300 }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.expenses = [];
  mocks.archive.mockResolvedValue(undefined);
});

function Example({ id }: { id?: string }) {
  const [open, setOpen] = useState(true);
  return <DeskProvider value={{ tab: 'expenses', isStaff: false, go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), toast: mocks.toast,
    close: () => { mocks.close(); setOpen(false); } }}>
    {open ? <ExpenseForm id={id} /> : null}
  </DeskProvider>;
}

function existingExpense() {
  mocks.expenses = [{ id: 'expense', date: '2026-10-22', category: 'Alquiler', amount: 100, currency: 'ARS', exchangeRate: 1300, notes: 'Nota original', deletedAt: null }];
  return render(<Example id="expense" />);
}

it.each(['Cancelar', 'Cerrar', 'Escape', 'backdrop'])('shows only the archive dialog and restores all expense edits on %s', async (dismissal) => {
  existingExpense();
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '23/10/2026' } });
  fireEvent.blur(screen.getByLabelText('Fecha'));
  fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Servicios' } });
  fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '456' } });
  await userEvent.click(screen.getByRole('button', { name: 'Dólares' }));
  fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Borrador editado' } });
  await userEvent.click(screen.getByRole('button', { name: 'Archivar gasto' }));
  const confirmation = screen.getByRole('dialog', { name: 'Archivar gasto' });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.queryByRole('dialog', { name: 'Editar gasto' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Categoría')).not.toBeInTheDocument();
  if (dismissal === 'Escape') await userEvent.keyboard('{Escape}');
  else if (dismissal === 'backdrop') fireEvent.mouseDown(confirmation.parentElement!);
  else await userEvent.click(screen.getByRole('button', { name: dismissal }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Editar gasto' })).toBeInTheDocument();
  expect(screen.getByLabelText('Fecha')).toHaveValue('23/10/2026');
  expect(screen.getByLabelText('Categoría')).toHaveValue('Servicios');
  expect(screen.getByLabelText('Monto')).toHaveValue('456');
  expect(screen.getByRole('button', { name: 'Dólares' })).toHaveClass('on');
  expect(screen.getByLabelText('Notas')).toHaveValue('Borrador editado');
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.archive).not.toHaveBeenCalled();
});

it('keeps the expense archive error and reason visible and closes everything only after a successful retry', async () => {
  mocks.archive.mockRejectedValueOnce(new Error('No se pudo archivar el gasto.'));
  existingExpense();
  await userEvent.click(screen.getByRole('button', { name: 'Archivar gasto' }));
  await userEvent.click(screen.getByRole('button', { name: 'Duplicado' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Detalle' }), 'Registro repetido');
  await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo archivar el gasto.');
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Archivar gasto' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Detalle' })).toHaveValue('Registro repetido');
  expect(screen.getByRole('button', { name: 'Duplicado' })).toHaveAttribute('aria-pressed', 'true');
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.toast).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
  expect(mocks.archive).toHaveBeenNthCalledWith(2, 'expense', 'Duplicado · Registro repetido');
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith('Gasto archivado');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps a pending expense mounted through Escape/backdrop, preserving values and showing failure without success', async () => {
  const user = userEvent.setup();
  let reject: (reason: Error) => void = () => undefined;
  mocks.save.mockImplementation(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
  render(<Example />);
  await user.type(screen.getByLabelText('Categoría'), 'Alquiler sintético');
  await user.type(screen.getByLabelText('Monto'), '123');
  await user.type(screen.getByLabelText('Notas'), 'Conservar este borrador');
  await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  await user.keyboard('{Escape}');
  fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Nuevo gasto' }).parentElement!);
  expect(mocks.close).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Categoría')).toHaveValue('Alquiler sintético');
  await act(async () => { reject(new Error('No se pudo guardar el gasto.')); });
  expect(screen.getByRole('dialog', { name: 'Nuevo gasto' })).toHaveTextContent('No se pudo guardar el gasto.');
  expect(screen.getByLabelText('Notas')).toHaveValue('Conservar este borrador');
  expect(screen.getByRole('button', { name: 'Guardar gasto' })).toBeEnabled();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.toast).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(mocks.close).toHaveBeenCalledOnce();
});

it('still lets successful persistence close directly while user dismissal is busy', async () => {
  const user = userEvent.setup();
  mocks.save.mockResolvedValue(undefined);
  render(<Example />);
  await user.type(screen.getByLabelText('Categoría'), 'Alquiler sintético');
  await user.type(screen.getByLabelText('Monto'), '123');
  await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledExactlyOnceWith('Gasto cargado');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
