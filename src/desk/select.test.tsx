import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeskSelect, type SelectOption } from './select';
import { Sheet } from './ui';

const options: SelectOption[] = [
  { value: 'payment', label: 'Medio de pago' },
  { value: 'model', label: 'Modelo' },
  { value: 'condition', label: 'Condición', disabled: true },
  { value: 'color', label: 'Color' },
  { value: 'seller', label: 'Vendedor' },
];

function Example({ onChange = vi.fn(), disabled = false, initial = 'payment', required = false }: { onChange?: (value: string) => void; disabled?: boolean; initial?: string; required?: boolean }) {
  const [value, setValue] = useState(initial);
  return <DeskSelect label="Desglose" value={value} options={options} disabled={disabled} name="dimension" required={required} onChange={(next) => { setValue(next); onChange(next); }} />;
}
const trigger = () => screen.getByRole('combobox', { name: 'Desglose' });
const active = (control = trigger()) => document.getElementById(control.getAttribute('aria-activedescendant')!);

function mobile() {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('max-width'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
}

describe('DeskSelect', () => {
  it('keeps option names and form data when the compact trigger has a custom display', async () => {
    render(<form aria-label="Filtros"><DeskSelect className="history-filter" triggerClassName="history-chip" label="Persona" value="model" displayValue="Persona" name="person" options={options} onChange={vi.fn()} /></form>);
    const control = screen.getByRole('combobox', { name: 'Persona' });
    expect(control).toHaveTextContent('Persona');
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('person')).toBe('model');
    await userEvent.click(control);
    expect(screen.getByRole('option', { name: 'Modelo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Condición' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    expect(control).toHaveFocus();
  });

  it('opens, exposes selection and toggles closed without changing value', async () => {
    const change = vi.fn();
    render(<Example onChange={change} />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toHaveAttribute('id', trigger().getAttribute('aria-controls'));
    expect(screen.getByRole('option', { name: 'Medio de pago' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(trigger());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('selects an option, closes and restores focus', async () => {
    const change = vi.fn();
    render(<Example onChange={change} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: 'Modelo' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('model');
    expect(trigger()).toHaveTextContent('Modelo');
    expect(trigger()).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates both arrows, skips disabled options and commits only on Enter', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Example onChange={change} />);
    trigger().focus();
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('Medio de pago');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(active()).toHaveTextContent('Color');
    await user.keyboard('{ArrowUp}');
    expect(active()).toHaveTextContent('Modelo');
    expect(change).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(change).toHaveBeenCalledExactlyOnceWith('model');
  });

  it('supports Home, End, wrapping and Space selection', async () => {
    render(<Example />);
    trigger().focus();
    await userEvent.keyboard('{End}');
    expect(active()).toHaveTextContent('Vendedor');
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('Medio de pago');
    await userEvent.keyboard('{ArrowUp}');
    expect(active()).toHaveTextContent('Vendedor');
    await userEvent.keyboard('{Home}');
    expect(active()).toHaveTextContent('Medio de pago');
    await userEvent.keyboard('{End} ');
    expect(trigger()).toHaveTextContent('Vendedor');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports typeahead and repeated initials without committing', async () => {
    render(<Example />);
    trigger().focus();
    await userEvent.keyboard('m');
    expect(active()).toHaveTextContent('Modelo');
    await userEvent.keyboard('m');
    expect(active()).toHaveTextContent('Medio de pago');
    expect(trigger()).toHaveTextContent('Medio de pago');
  });

  it('closes with Escape, preserves selection and reopens on the selected item', async () => {
    render(<Example initial="model" />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{End}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveTextContent('Modelo');
    await userEvent.keyboard('{Enter}');
    expect(active()).toHaveTextContent('Modelo');
  });

  it('closes on outside pointer/focus and Tab without stealing the next focus', async () => {
    render(<><Example /><button>Otra acción</button></>);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Otra acción' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otra acción' })).toHaveFocus();
    await userEvent.click(trigger());
    await userEvent.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otra acción' })).toHaveFocus();
    await userEvent.click(trigger());
    fireEvent.focusIn(screen.getByRole('button', { name: 'Otra acción' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open when disabled and ignores disabled options', async () => {
    const change = vi.fn();
    const { rerender } = render(<Example disabled onChange={change} />);
    await userEvent.click(trigger());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    rerender(<Example onChange={change} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: 'Condición' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    rerender(<Example disabled onChange={change} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('preserves FormData and required validation through the visible control', async () => {
    const { container } = render(<form><Example initial="" required /></form>);
    const form = container.querySelector('form')!;
    act(() => { expect(form.checkValidity()).toBe(false); });
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('option', { name: 'Modelo' }));
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('dimension')).toBe('model');
    expect(trigger()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('closes only the dropdown when Escape is pressed inside a parent Sheet', async () => {
    const close = vi.fn();
    render(<Sheet title="Configuración" onClose={close}><Example /></Sheet>);
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledExactlyOnceWith();
  });

  it('opens a mobile modal, contains focus, makes the background inert and restores it on selection', async () => {
    const media = mobile();
    try {
      const { container } = render(<Example />);
      await userEvent.click(trigger());
      const dialog = screen.getByRole('dialog', { name: 'Desglose' });
      const list = screen.getByRole('listbox');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(list).toHaveFocus();
      expect(container.inert).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'Cerrar selector' })).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(list).toHaveFocus();
      await userEvent.keyboard('{End}{Enter}');
      expect(trigger()).toHaveTextContent('Vendedor');
      expect(trigger()).toHaveFocus();
      expect(container.inert).not.toBe(true);
      expect(document.body.style.overflow).toBe('');
    } finally { media.mockRestore(); }
  });

  it('dismisses a mobile sheet by its close button, backdrop and Escape', async () => {
    const media = mobile();
    try {
      render(<Example />);
      await userEvent.click(trigger());
      await userEvent.keyboard('{End}{Tab}{Enter}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveTextContent('Medio de pago');
      await userEvent.click(trigger());
      fireEvent.pointerDown(document.querySelector('.ds-select-backdrop')!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(document.querySelector('.ds-select-backdrop')!);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.click(trigger());
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    } finally { media.mockRestore(); }
  });
});

it('consumes the mobile backdrop gesture before closing without bubbling to the underlying tab or parent sheet', async () => {
  const media = mobile();
  try {
    const down = vi.fn(); const up = vi.fn(); const click = vi.fn(); const change = vi.fn(); const close = vi.fn();
    render(<div onPointerDown={down} onPointerUp={up} onClick={click}><Sheet title="Tienda" onClose={close}><Example onChange={change} /></Sheet><button>Ventas</button></div>);
    await userEvent.click(trigger()); down.mockClear(); up.mockClear(); click.mockClear();
    const backdrop = document.querySelector('.ds-select-backdrop')!;
    const pointer = new Event('pointerdown', { bubbles: true, cancelable: true });
    fireEvent(backdrop, pointer);
    expect(pointer.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Desglose' })).toBeVisible();
    expect(down).not.toHaveBeenCalled();
    const release = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(backdrop, release);
    expect(release.defaultPrevented).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Desglose' })).toBeNull();
    expect(click).not.toHaveBeenCalled(); expect(up).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
    await userEvent.click(trigger()); down.mockClear(); up.mockClear(); click.mockClear();
    const again = document.querySelector('.ds-select-backdrop')!;
    fireEvent(again, new Event('pointerdown', { bubbles: true, cancelable: true }));
    const pointerUp = new Event('pointerup', { bubbles: true, cancelable: true });
    fireEvent(again, pointerUp);
    expect(pointerUp.defaultPrevented).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Desglose' })).toBeNull();
    const leaked = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('button', { name: 'Ventas' }), leaked);
    expect(leaked.defaultPrevented).toBe(true);
    expect(up).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
  } finally { media.mockRestore(); }
});
