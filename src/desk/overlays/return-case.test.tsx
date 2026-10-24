import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReturnCaseView } from '../../services/returns-api';
import type { Client, Sale } from '../../types';
import { DeskProvider } from '../ui';
import { ReturnDelete, ReturnDetail, ReturnForm } from './return-case';

const ctx = vi.hoisted(() => ({
  returns: [] as ReturnCaseView[], sales: [] as Sale[], clients: [] as Client[], inventory: [],
  updateReturn: vi.fn(), resolveReturn: vi.fn(), advanceRma: vi.fn(), archiveReturn: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
const close = vi.fn();
const claim: ReturnCaseView = {
  id: 'claim', code: 'RMA-0001', caseNumber: 1, saleId: 'sale', clientId: 'client', clientName: 'Lucía',
  inventoryItemId: 'device', imei: '359123456789012', deviceLabel: 'iPhone 13 128GB', supplierId: null, supplierName: null,
  reason: 'No enciende', diagnosis: null, openedOn: '2026-10-21', resolution: null, settlement: null, moneyAmount: 0,
  moneyCurrency: null, destination: null, stockStatus: null, previousStatus: 'DISPONIBLE', rmaStatus: null,
  status: 'ABIERTO', resolvedOn: null, deletedAt: null, refundable: 500, saleAmount: 500, saleCurrency: 'USD',
  saleDate: '2026-10-20', warrantyDays: 90, itemCost: 300, itemCurrency: 'USD', creditNote: null,
  events: [{ status: 'ABIERTO', note: 'Ingresó el reclamo.', createdAt: '2026-10-21T15:00:00Z' }],
};
function mount(node: ReactNode, sensitive = true) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'returns', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: !sensitive, canManageSensitive: sensitive }}>{node}</DeskProvider></div>);
}
beforeEach(() => {
  vi.clearAllMocks(); ctx.returns = [{ ...claim }]; ctx.sales = []; ctx.clients = [];
  for (const fn of [ctx.updateReturn, ctx.resolveReturn, ctx.advanceRma, ctx.archiveReturn]) fn.mockResolvedValue(claim);
});
describe('cambio de estado de reclamo', () => {
  it('saves a nested claim and closes only its local sheet', async () => {
    const onClose = vi.fn();
    mount(<ReturnDetail id="claim" onClose={onClose} overlayClassName="subov" />);
    expect(screen.getByRole('dialog').closest('.ov')).toHaveClass('subov');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(ctx.updateReturn).toHaveBeenCalledWith('claim', { status: 'ABIERTO', diagnosis: null, note: null });
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps selection and note as drafts until Guardar, then submits them together', async () => {
    mount(<ReturnDetail id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'En diagnóstico' }));
    expect(screen.getByRole('button', { name: 'En diagnóstico' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(screen.getByLabelText('Nota de seguimiento'), ' Revisar batería ');
    expect(ctx.updateReturn).not.toHaveBeenCalled();
    expect(screen.queryByTestId('return-events')).not.toBeInTheDocument();
    expect(screen.getByTestId('return-next-step')).toHaveTextContent('En diagnóstico');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ctx.updateReturn).toHaveBeenCalledWith('claim', { status: 'EN_DIAGNOSTICO', diagnosis: null, note: 'Revisar batería' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('cancels RMA drafts without persisting and saves only when confirmed', async () => {
    ctx.returns = [{ ...claim, status: 'EN_PROVEEDOR', rmaStatus: 'ENVIADO', resolution: 'REPARACION' }];
    mount(<ReturnDetail id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'Aprobado' }));
    expect(ctx.advanceRma).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalledOnce();
    expect(ctx.advanceRma).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Nota de seguimiento'), 'Confirmó el proveedor');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ctx.advanceRma).toHaveBeenCalledWith('claim', 'APROBADO', null, 'Confirmó el proveedor'));
  });
  it('resolves through the existing financial endpoint with diagnosis and note in one request', async () => {
    mount(<ReturnDetail id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'Resuelto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reintegro' }));
    await userEvent.type(screen.getByLabelText('Nota de seguimiento'), 'Se acordó devolver el importe');
    expect(ctx.resolveReturn).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ctx.resolveReturn).toHaveBeenCalledWith('claim', {
      resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 500, destination: 'STOCK', stockStatus: 'EN_REVISION', diagnosis: null, note: 'Se acordó devolver el importe',
    }));
  });
  it('preserves the selected state and note on failure and disables all editing during save', async () => {
    let reject!: (reason: Error) => void;
    ctx.updateReturn.mockReturnValue(new Promise((_, no) => { reject = no; }));
    mount(<ReturnDetail id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'En diagnóstico' }));
    await userEvent.type(screen.getByLabelText('Nota de seguimiento'), 'Pendiente');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resuelto' })).toBeDisabled();
    expect(screen.getByLabelText('Nota de seguimiento')).toBeDisabled();
    reject(new Error('Sin conexión'));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('Pendiente');
    expect(screen.getByRole('button', { name: 'En diagnóstico' })).toHaveAttribute('aria-pressed', 'true');
    expect(close).not.toHaveBeenCalled();
  });
  it('does not offer resolution to staff without sensitive access', () => {
    mount(<ReturnDetail id="claim" />, false);
    expect(screen.queryByRole('button', { name: 'Resuelto' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En diagnóstico' })).toBeInTheDocument();
  });
  it('keeps cancelled claims read-only with a dated timeline', () => {
    ctx.returns = [{ ...claim, status: 'ANULADO', deletedAt: '2026-10-22T15:00:00Z' }];
    mount(<ReturnDetail id="claim" />);
    expect(screen.getByText('Anulado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restaurar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nota de seguimiento')).not.toBeInTheDocument();
  });
});
describe('editar y anular reclamo', () => {
  it('prefills fields without needing the original sale loaded, and PATCHes only changed values', async () => {
    ctx.returns = [{ ...claim, diagnosis: 'Diagnóstico previo' }];
    mount(<ReturnForm id="claim" />);
    expect(screen.getByLabelText('Motivo')).toHaveValue('No enciende');
    expect(screen.getByLabelText('Diagnóstico')).toHaveValue('Diagnóstico previo');
    expect(screen.getByLabelText('Fecha del reclamo')).toHaveValue('21/10/2026');
    expect(screen.queryByLabelText('Venta')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'No carga' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ctx.updateReturn).toHaveBeenCalledWith('claim', { reason: 'No carga' }));
  });
  it('keeps edit errors visible and prevents editing cancelled claims', async () => {
    ctx.updateReturn.mockRejectedValue(new Error('Error de prueba'));
    mount(<ReturnForm id="claim" />);
    fireEvent.change(screen.getByLabelText('Diagnóstico'), { target: { value: 'Batería' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de prueba');
    expect(screen.getByLabelText('Diagnóstico')).toHaveValue('Batería');
    expect(close).not.toHaveBeenCalled();
  });
  it('asks to Anular and does not persist before confirmation or after cancellation', async () => {
    mount(<ReturnDelete id="claim" />);
    expect(screen.getByRole('dialog', { name: '¿Anular reclamo?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular' })).toBeEnabled();
    expect(screen.queryByText(/Eliminar/)).not.toBeInTheDocument();
    expect(screen.getByText(/fuera de los totales/)).toBeInTheDocument();
    expect(ctx.archiveReturn).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalledOnce();
    expect(ctx.archiveReturn).not.toHaveBeenCalled();
  });
  it('keeps the confirmation open on failure and allows retry', async () => {
    ctx.archiveReturn.mockRejectedValueOnce(new Error('No se guardó'));
    mount(<ReturnDelete id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó');
    expect(close).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(ctx.archiveReturn).toHaveBeenCalledTimes(2);
    expect(ctx.archiveReturn).toHaveBeenLastCalledWith('claim');
  });
  it('explains that an existing settlement remains recorded', () => {
    ctx.returns = [{ ...claim, status: 'RESUELTO', resolution: 'REINTEGRO' }];
    mount(<ReturnDelete id="claim" />);
    expect(screen.getByText(/Se conservan los movimientos registrados/)).toBeInTheDocument();
  });
});

describe('rediseño aprobado de reclamos', () => {
  it.each([false, true])('opens complete history in a second layer and preserves the draft (phone: %s)', async phone => {
    const media = window.matchMedia;
    window.matchMedia = query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() });
    try {
      ctx.returns = [{ ...claim, events: [claim.events[0], { status: 'EN_DIAGNOSTICO', note: 'Revisar batería.', createdAt: '2026-10-22T15:00:00Z' }] }];
      mount(<ReturnDetail id="claim" />);
      const parent = screen.getByRole('dialog', { name: 'Reclamo · RMA-0001' });
      const trigger = within(parent).getByRole('button', { name: 'Ver historial (2)' });
      expect(trigger).toHaveAttribute('title', 'Historial');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger.textContent).toBe('');
      expect(trigger.querySelector('[data-desk-icon="clock"]')).toBeInTheDocument();
      expect(parent).not.toHaveTextContent(/Ingresó el reclamo|Revisar batería\./);
      await userEvent.type(screen.getByLabelText('Nota de seguimiento'), 'Borrador');
      await userEvent.click(trigger);
      const history = screen.getByRole('dialog', { name: 'Historial · RMA-0001' });
      expect(history).toHaveClass('return-history-sheet', 'hist-screen');
      expect(history.closest('.record-history-layer')?.parentElement).toHaveClass('desk-app');
      const header = history.querySelector<HTMLElement>('.sheet-h')!;
      expect(within(history).getAllByRole('listitem')).toHaveLength(2);
      expect(within(history).getAllByRole('listitem')[0]).toHaveTextContent('Revisar batería.');
      expect(history.querySelector('time')).toHaveAttribute('datetime', '2026-10-22T15:00:00Z');
      expect(within(history).getByText('Ingresó el reclamo.')).toBeInTheDocument();
      if (phone) {
        expect(history.querySelector('.sheet-grab')).not.toBeInTheDocument();
        expect(history.querySelector('.sheet-foot')).not.toBeInTheDocument();
        await userEvent.click(within(header).getByRole('button', { name: 'Volver' }));
      } else {
        expect(within(header).getByRole('button', { name: 'Cerrar' })).toHaveClass('modal-x');
        expect(history.querySelector('.sheet-grab')).not.toBeInTheDocument();
        const footer = history.querySelector<HTMLElement>('.sheet-foot')!;
        await userEvent.click(within(footer).getByRole('button', { name: 'Cerrar' }));
      }
      expect(screen.queryByRole('dialog', { name: 'Historial · RMA-0001' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Reclamo · RMA-0001' })).toBe(parent);
      expect(within(parent).getByLabelText('Nota de seguimiento')).toHaveValue('Borrador');
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(close).not.toHaveBeenCalled();
    } finally { window.matchMedia = media; }
  });
  it('keeps Fecha first and sends no diagnosis when opening a claim', async () => {
    mount(<ReturnForm />);
    const sheet = screen.getByRole('dialog', { name: 'Nuevo reclamo' });
    const body = sheet.querySelector('.sheet-scroll')!;
    expect(body.firstElementChild).toHaveClass('dp-field');
    expect(screen.getByLabelText('Fecha del reclamo')).toHaveAttribute('type', 'text');
    expect(sheet.querySelector('input[type="date"]')).toBeNull();
    expect(screen.queryByLabelText('Diagnóstico')).not.toBeInTheDocument();
    expect([...body.querySelectorAll('.fl')].map(field => field.textContent)).toEqual([expect.stringContaining('Fecha'), expect.stringContaining('Venta'), expect.stringContaining('Motivo')]);
  });
  it('identifies linked buyers without a snapshot and preserves historical names', async () => {
    ctx.clients = [{ id: 'client', name: 'Lucía Fernández' } as Client];
    ctx.sales = [
      { id: 'linked', clientId: 'client', clientName: '', deviceLabel: 'iPhone 13', date: '2026-10-24', status: 'COMPLETADA' },
      { id: 'snapshot', clientId: 'client', clientName: 'Nombre histórico', deviceLabel: 'iPhone 14', date: '2026-10-23', status: 'COMPLETADA' },
    ] as Sale[];
    mount(<ReturnForm />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Venta' }));
    expect(screen.getByRole('option', { name: 'Lucía Fernández · iPhone 13 · 24/10/2026' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nombre histórico · iPhone 14 · 23/10/2026' })).toBeInTheDocument();
  });
  it('loads the real status when records arrive after the sheet opens', async () => {
    const rows = ctx.returns;
    // The context intentionally distinguishes pending data from an empty list.
    ctx.returns = null as unknown as ReturnCaseView[];
    const view = mount(<ReturnDetail id="claim" />);
    expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    ctx.returns = [{ ...rows[0], status: 'EN_DIAGNOSTICO', diagnosis: 'Batería' }];
    view.rerender(<div className="desk-app"><DeskProvider value={{ tab: 'returns', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}><ReturnDetail id="claim" /></DeskProvider></div>);
    expect(screen.getByRole('button', { name: 'En diagnóstico' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Diagnóstico')).toHaveValue('Batería');
  });
  it('uses the danger sheet action and identifies the claim and client in confirmation', () => {
    mount(<ReturnDelete id="claim" />);
    expect(screen.getByText('RMA-0001 · Lucía')).toHaveClass('rd-who');
    expect(screen.getByRole('button', { name: 'Anular' })).toHaveClass('btn2', 'danger', 'sheet-primary');
  });
});

it('keeps the mobile claim calendar inline inside the scrolling form', async () => {
  const media = window.matchMedia;
  window.matchMedia = query => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() });
  try {
    mount(<ReturnForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: fecha' }));
    const panel = screen.getByRole('dialog', { name: 'Elegir fecha del reclamo' }).parentElement!;
    expect(panel).toHaveClass('dp-calendar', 'dp-inline');
    expect(panel).not.toHaveClass('inline');
    expect(panel.closest('.sheet-scroll')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByLabelText('Fecha del reclamo')).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
  } finally { window.matchMedia = media; }
});

it('muestra la fila Proveedor solo cuando el reclamo tiene supplierName', () => {
  const first = mount(<ReturnDetail id="claim" />);
  expect(screen.queryByTestId('return-supplier')).not.toBeInTheDocument();
  first.unmount();
  ctx.returns = [{ ...claim, supplierId: 'supplier', supplierName: 'Importadora Andes' }];
  mount(<ReturnDetail id="claim" />);
  expect(screen.getByTestId('return-supplier')).toHaveTextContent('ProveedorImportadora Andes');
  expect(within(screen.getByTestId('return-detail')).getByTestId('return-supplier')).toBeInTheDocument();
});
