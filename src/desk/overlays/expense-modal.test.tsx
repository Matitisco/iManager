import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ExpenseForm } from './expense';
import { DeskProvider } from '../ui';

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), close: vi.fn(), archived: vi.fn(), restore: vi.fn(), mutateCash: vi.fn() }));
const user = { uid: 'owner' };
vi.mock('../../services/expenses-api', () => ({ fetchExpenses: mocks.archived }));
vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ user, expenses: [], saveExpense: mocks.save, restoreExpense: mocks.restore, mutateCash: mocks.mutateCash }),
}));
vi.mock('../exchange', () => ({
  useMoney: () => ({ active: 'ARS', rate: 1300 }),
}));

function Example({ id }: { id?: string }) {
  const [open, setOpen] = useState(true);
  return <DeskProvider value={{ tab: 'expenses', isStaff: false, go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), toast: mocks.toast,
    close: () => { mocks.close(); setOpen(false); } }}>
    {open ? <ExpenseForm id={id} /> : null}
  </DeskProvider>;
}

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
  expect(mocks.mutateCash).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ amount: 123, category: 'Alquiler sintético' }), undefined);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('carga los valores archivados y restaura sin guardar otro gasto ni mover caja', async () => {
  mocks.archived.mockResolvedValue([{ id: 'archived', date: '2026-10-02', category: 'Servicios', amount: 5500, currency: 'ARS', notes: 'Internet', deletedAt: '2026-10-20T12:00:00Z' }]);
  mocks.restore.mockResolvedValue(undefined);
  render(<Example id="archived" />);
  expect(await screen.findByRole('button', { name: 'Restaurar' })).toBeVisible();
  expect(screen.getByLabelText('Categoría')).toHaveValue('Servicios');
  expect(screen.getByLabelText('Notas')).toHaveValue('Internet');
  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
  expect(mocks.restore).toHaveBeenCalledWith('archived');
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.mutateCash).not.toHaveBeenCalled();
});

it('un archivado que no puede leerse no se transforma en un gasto nuevo', async () => {
  mocks.archived.mockRejectedValue(new Error('No se pudo leer el gasto'));
  render(<Example id="missing" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el gasto');
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.mutateCash).not.toHaveBeenCalled();
});
