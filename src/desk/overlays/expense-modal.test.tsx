import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ExpenseForm } from './expense';
import { DeskProvider } from '../ui';

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), close: vi.fn() }));
vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ expenses: [], saveExpense: mocks.save }),
}));
vi.mock('../exchange', () => ({
  useMoney: () => ({ active: 'ARS', rate: 1300 }),
}));

function Example() {
  const [open, setOpen] = useState(true);
  return <DeskProvider value={{ tab: 'expenses', isStaff: false, go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), toast: mocks.toast,
    close: () => { mocks.close(); setOpen(false); } }}>
    {open ? <ExpenseForm /> : null}
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
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
