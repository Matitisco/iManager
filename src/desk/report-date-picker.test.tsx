import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportDatePicker } from './report-date-picker';

function Harness({ initial = '2026-09-10' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <><ReportDatePicker label="Fecha de inicio" value={value} onChange={setValue} /><output data-testid="value">{value}</output><button type="button">Otro control</button></>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T12:00:00-03:00'));
});
afterEach(() => vi.useRealTimers());

const open = () => userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: fecha de inicio' }));

describe('Reports date picker', () => {
  it('shows the selected local date and selects a day without opening a native popup', async () => {
    render(<Harness />);
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('10/09/2026');
    expect(screen.getByLabelText('Fecha de inicio')).toHaveAttribute('type', 'text');
    await open();
    const selected = screen.getByRole('button', { name: 'jueves, 10 de septiembre de 2026' });
    expect(selected.parentElement).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'martes, 15 de septiembre de 2026' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2026-09-15');
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('15/09/2026');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de inicio')).toHaveFocus();
  });

  it('allows typed dd/mm/yyyy and leaves partial input available for validation', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Fecha de inicio');
    await userEvent.clear(input);
    await userEvent.type(input, '29/02/2024');
    expect(screen.getByTestId('value')).toHaveTextContent('2024-02-29');
    expect(input).toHaveValue('29/02/2024');
    fireEvent.change(input, { target: { value: '12/' } });
    expect(input).toHaveValue('12/');
    expect(screen.getByTestId('value')).toHaveTextContent('12/');
  });

  it('navigates month and year views for historical dates', async () => {
    render(<Harness />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Elegir mes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Elegir año' }));
    await userEvent.click(screen.getByRole('button', { name: '2024' }));
    await userEvent.click(screen.getByRole('button', { name: 'feb' }));
    await userEvent.click(screen.getByRole('button', { name: 'jueves, 29 de febrero de 2024' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2024-02-29');
  });

  it('moves focus across month boundaries with arrows and PageUp/PageDown', async () => {
    render(<Harness initial="2024-01-31" />);
    const input = screen.getByLabelText('Fecha de inicio');
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'miércoles, 31 de enero de 2024' })).toHaveFocus();
    await userEvent.keyboard('{PageDown}');
    expect(screen.getByRole('button', { name: 'jueves, 29 de febrero de 2024' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'viernes, 1 de marzo de 2024' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'lunes, 26 de febrero de 2024' })).toHaveFocus();
    await userEvent.keyboard('{End}{Enter}');
    expect(input).toHaveValue('03/03/2024');
    expect(input).toHaveFocus();
  });

  it('dismisses with Escape and outside interactions, restoring focus only for Escape', async () => {
    render(<Harness />);
    await open();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de inicio')).toHaveFocus();
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Otro control' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otro control' })).toHaveFocus();
  });

  it('selects Today and clears the date using the popup footer', async () => {
    render(<Harness />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-07');
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('');
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
  });

  it('opens from an empty value and exposes exactly one day in the tab order', async () => {
    render(<Harness initial="" />);
    await open();
    expect(screen.getByRole('button', { name: 'miércoles, 7 de octubre de 2026' })).toHaveFocus();
    const days = within(screen.getByRole('grid')).getAllByRole('button');
    expect(days.filter((day) => day.tabIndex === 0)).toHaveLength(1);
    expect(days.filter((day) => day.getAttribute('aria-current') === 'date')).toHaveLength(1);
  });
});
