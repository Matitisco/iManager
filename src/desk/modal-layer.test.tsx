import { StrictMode, useState } from 'react';
import { createPortal } from 'react-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, Sheet, SheetActionMenu, SheetActions, useEscape } from './ui';
import { DeskSelect } from './select';
import { ReportDatePicker } from './report-date-picker';
import { CatalogEditor } from './catalog';

function phone() {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query.includes('max-width'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
    removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

function Example({ portal = false, childBusy = false, simultaneous = false, onClose = () => undefined }: {
  portal?: boolean; childBusy?: boolean; simultaneous?: boolean; onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [child, setChild] = useState(simultaneous);
  const close = () => { onClose(); setOpen(false); };
  const confirmation = child ? <Dialog title="Confirmación" text="Conserva el formulario" ok="Confirmar" busy={childBusy} onOk={() => setOpen(false)} onClose={() => setChild(false)} /> : null;
  return <>
    <button onClick={() => setOpen(true)}>Abrir</button>
    <button>Fondo</button>
    {open ? <Sheet title="Formulario" onClose={close}>
      <input aria-label="Dato" />
      <button hidden>Oculto</button>
      <button disabled>Deshabilitado</button>
      <button onClick={() => setChild(true)}>Confirmación</button>
      {portal ? createPortal(confirmation, document.body) : confirmation}
    </Sheet> : null}
  </>;
}

describe('shared modal interaction', () => {
  it('enters focus, contains Tab/Shift+Tab and programmatic focus, then restores the trigger', async () => {
    const user = userEvent.setup();
    render(<StrictMode><Example /></StrictMode>);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    const surface = screen.getByRole('dialog', { name: 'Formulario' });
    expect(surface).toHaveFocus();
    await user.tab();
    const headerClose = within(surface).getByRole('button', { name: 'Cerrar' });
    expect(headerClose).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Dato')).toHaveFocus();
    await user.tab({ shift: true });
    expect(headerClose).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(surface).getByRole('button', { name: 'Confirmación' })).toHaveFocus();
    await user.tab();
    expect(headerClose).toHaveFocus();
    screen.getByRole('button', { name: 'Fondo' }).focus();
    expect(surface).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('wraps focus through a final disclosure summary, skipping its closed actions', async () => {
    const user = userEvent.setup();
    render(<Sheet title="Acciones" onClose={() => undefined} footer={<SheetActions>
      <SheetActionMenu><button type="button">Archivar</button></SheetActionMenu>
    </SheetActions>}><input aria-label="Dato" /></Sheet>);
    const surface = screen.getByRole('dialog', { name: 'Acciones' });
    const summary = screen.getByText('Más acciones');
    const headerClose = within(surface).getByRole('button', { name: 'Cerrar' });
    await user.tab({ shift: true });
    expect(summary).toHaveFocus();
    await user.tab();
    expect(headerClose).toHaveFocus();
    await user.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    const archive = screen.getByRole('button', { name: 'Archivar' });
    archive.focus();
    await user.tab();
    expect(headerClose).toHaveFocus();
    await user.tab({ shift: true });
    expect(archive).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(summary).toHaveFocus();
    await user.tab();
    expect(headerClose).toHaveFocus();
  });

  it.each([false, true])('closes only the top confirmation (portal=%s), preserving the parent and returning focus', async portal => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<Example portal={portal} onClose={close} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const trigger = screen.getByRole('button', { name: 'Confirmación' });
    await user.click(trigger);
    const child = screen.getByRole('dialog', { name: 'Confirmación' });
    expect(within(child).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    screen.getByLabelText('Dato').focus();
    expect(child).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Confirmación' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Formulario' })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });

  it('handles simultaneous portaled children and restores the outer trigger when the whole branch disappears', async () => {
    const user = userEvent.setup();
    render(<Example portal simultaneous />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    const child = screen.getByRole('dialog', { name: 'Confirmación' });
    expect(child).toContainElement(document.activeElement as HTMLElement);
    await user.click(within(child).getByRole('button', { name: 'Confirmar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('consumes Escape and backdrop dismissal while the top child is busy, including legacy window listeners', async () => {
    const user = userEvent.setup();
    const legacy = vi.fn();
    function Legacy() { useEscape(legacy); return <Example childBusy portal />; }
    render(<Legacy />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'Confirmación' }));
    const child = screen.getByRole('dialog', { name: 'Confirmación' });
    await user.keyboard('{Escape}');
    fireEvent.mouseDown(child.parentElement!);
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Formulario' }).parentElement!);
    expect(child).toBeInTheDocument();
    expect(legacy).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
  });

  it('blocks sheet X/backdrop/Escape while busy and uses fresh close props without moving focus', async () => {
    phone();
    try {
      const user = userEvent.setup();
      const oldClose = vi.fn();
      const close = vi.fn();
      const view = render(<Sheet title="Guardado" busy onClose={oldClose}><input aria-label="Dato" /></Sheet>);
      const field = screen.getByLabelText('Dato');
      field.focus();
      await user.keyboard('{Escape}');
      fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
      expect(oldClose).not.toHaveBeenCalled();
      view.rerender(<Sheet title="Guardado" onClose={close}><input aria-label="Dato" /></Sheet>);
      expect(field).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(close).toHaveBeenCalledOnce();
      expect(oldClose).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });

  it('contains an empty busy dialog and releases listeners on unmount/StrictMode replay', async () => {
    const user = userEvent.setup();
    const legacy = vi.fn();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') legacy(); };
    window.addEventListener('keydown', onKey);
    try {
      const view = render(<StrictMode><Dialog title="Enviando" text="Esperá" ok="Confirmar" busy onClose={() => undefined} onOk={() => undefined} /></StrictMode>);
      await user.tab();
      expect(screen.getByRole('dialog')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(legacy).not.toHaveBeenCalled();
      view.unmount();
      await act(async () => { await Promise.resolve(); });
      await user.keyboard('{Escape}');
      expect(legacy).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('keydown', onKey); }
  });

  it('lets a portaled mobile selector own focus/Escape before its sheet', async () => {
    phone();
    try {
      const user = userEvent.setup();
      const close = vi.fn();
      render(<Sheet title="Regla" onClose={close}>
        <DeskSelect label="Persona" value="ana" onChange={() => undefined} options={[{ value: 'ana', label: 'Ana' }]} />
      </Sheet>);
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      const child = screen.getByRole('dialog', { name: 'Persona' });
      expect(within(child).getByRole('listbox')).toHaveFocus();
      await user.tab();
      expect(within(child).getByRole('button', { name: 'Cerrar selector' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Persona' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(close).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(close).toHaveBeenCalledOnce();
    } finally { vi.restoreAllMocks(); }
  });

  it('lets the existing calendar consume Escape before closing its sheet', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<Sheet title="Período" onClose={close}>
      <ReportDatePicker label="Inicio" value="2026-10-01" onChange={() => undefined} />
    </Sheet>);
    await user.click(screen.getByRole('button', { name: 'Abrir calendario: inicio' }));
    expect(screen.getByRole('dialog', { name: 'Elegir inicio' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Elegir inicio' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Inicio')).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });

  it('lets the existing state editor own focus and close before its sheet', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    function Example() {
      const [editing, setEditing] = useState(false);
      return <Sheet title="Equipo" onClose={close}>
        <button onClick={() => setEditing(true)}>Editar estados</button>
        {editing ? <CatalogEditor kind="INVENTORY_STATUS" onClose={() => setEditing(false)} /> : null}
      </Sheet>;
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Editar estados' });
    await user.click(trigger);
    const child = screen.getByRole('dialog', { name: 'Estados de equipo' });
    expect(child).toHaveFocus();
    trigger.focus();
    expect(child).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Estados de equipo' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });
});
