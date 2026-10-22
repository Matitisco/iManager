import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { DatePicker } from './date-picker';
import { Sheet } from './ui';

afterEach(() => vi.restoreAllMocks());

it('keeps optional dates clearable and associates validation errors with the field', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<DatePicker label="Cumpleaños" value="" onChange={onChange} error="Ingresá una fecha válida." />);
  const input = screen.getByLabelText('Cumpleaños');
  expect(input).not.toBeRequired();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Ingresá una fecha válida.');
  rerender(<DatePicker label="Cumpleaños" value="2000-02-29" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /Abrir calendario/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
  expect(onChange).toHaveBeenCalledWith('');
  expect(input).toHaveFocus();
});

it('disables the input and trigger and closes an open panel when disabled', async () => {
  const props = { label: 'Vigente desde', value: '2026-10-01', onChange: vi.fn(), required: true };
  const { rerender } = render(<DatePicker {...props} />);
  expect(screen.getByLabelText(props.label)).toBeRequired();
  await userEvent.click(screen.getByRole('button', { name: /Abrir calendario/ }));
  rerender(<DatePicker {...props} disabled />);
  expect(screen.getByLabelText(props.label)).toBeDisabled();
  expect(screen.getByRole('button', { name: /Abrir calendario/ })).toBeDisabled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(props.onChange).not.toHaveBeenCalled();
});

it.each([390, 1440])('portals outside the scrolling sheet, fits %s px and follows scroll/resize', async width => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
  let top = 650;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: width - 90, top, bottom: top + 48, width: 200, height: 48, right: width + 110, x: width - 90, y: top, toJSON: () => ({}) }));
  render(<div className="desk-app"><Sheet title="Nuevo cliente" onClose={vi.fn()}><DatePicker label="Cumpleaños" value="2000-02-29" onChange={vi.fn()} /></Sheet></div>);
  const sheet = screen.getByRole('dialog', { name: 'Nuevo cliente' });
  await userEvent.click(screen.getByRole('button', { name: /Abrir calendario/ }));
  const panel = screen.getByRole('dialog', { name: 'Elegir cumpleaños' }).parentElement!;
  expect(sheet).not.toContainElement(panel);
  expect(panel.parentElement).toHaveClass('desk-app');
  expect(parseFloat(panel.style.left)).toBeGreaterThanOrEqual(12);
  expect(parseFloat(panel.style.left) + parseFloat(panel.style.width)).toBeLessThanOrEqual(width - 12);
  expect(parseFloat(panel.style.top)).toBe(278);
  top = 80;
  fireEvent.scroll(sheet.querySelector('.sheet-scroll')!);
  expect(parseFloat(panel.style.top)).toBe(136);
  fireEvent.resize(window);
  expect(parseFloat(panel.style.top)).toBe(136);
  // The nested calendar traps Tab without sending focus to the parent modal.
  within(panel).getByRole('button', { name: 'Hoy' }).focus();
  await userEvent.keyboard('{Tab}');
  expect(within(panel).getByRole('button', { name: 'Mes anterior' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Elegir cumpleaños' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Cumpleaños')).toHaveFocus();
  expect(sheet).toBeInTheDocument();
});

it('keeps the reports inline variant in the form and closes the previous picker', async () => {
  function Range() {
    const [start, setStart] = useState('2026-10-01');
    return <><DatePicker label="Desde" value={start} onChange={setStart} panel="inline" /><DatePicker label="Hasta" value="" onChange={vi.fn()} panel="inline" /></>;
  }
  const { container } = render(<Range />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: desde' }));
  expect(container).toContainElement(screen.getByRole('dialog', { name: 'Elegir desde' }));
  await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: hasta' }));
  expect(screen.queryByRole('dialog', { name: 'Elegir desde' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Elegir hasta' })).toBeInTheDocument();
});

it('lets the user return from the calendar to manually editing its field', async () => {
  render(<DatePicker label="Fecha" value="2026-10-22" onChange={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: fecha' }));
  await userEvent.click(screen.getByLabelText('Fecha'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Fecha')).toHaveFocus();
});
