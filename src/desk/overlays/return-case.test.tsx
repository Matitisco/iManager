import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReturnCaseView } from '../../services/returns-api';
import { DeskProvider } from '../ui';
import { ReturnDelete, ReturnDetail, ReturnForm } from './return-case';

const ctx = vi.hoisted(() => ({
  returns: [] as ReturnCaseView[], sales: [], inventory: [],
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
  vi.clearAllMocks(); ctx.returns = [{ ...claim }];
  for (const fn of [ctx.updateReturn, ctx.resolveReturn, ctx.advanceRma, ctx.archiveReturn]) fn.mockResolvedValue(claim);
});
describe('cambio de estado de reclamo', () => {
  it('keeps selection and note as drafts until Guardar, then submits them together', async () => {
    mount(<ReturnDetail id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'En diagnóstico' }));
    expect(screen.getByRole('button', { name: 'En diagnóstico' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), ' Revisar batería ');
    expect(ctx.updateReturn).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('return-events')).getByText('Ingresó el reclamo.')).toBeInTheDocument();
    expect(screen.getByTestId('return-events').querySelector('time')).toHaveAttribute('datetime', '2026-10-21T15:00:00Z');
    expect(screen.getByTestId('return-events').querySelector('time')).toHaveTextContent('21/10/2026');
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
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'Confirmó el proveedor');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ctx.advanceRma).toHaveBeenCalledWith('claim', 'APROBADO', null, 'Confirmó el proveedor'));
  });
  it('resolves through the existing financial endpoint with diagnosis and note in one request', async () => {
    mount(<ReturnDetail id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'Resuelto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reintegro' }));
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'Se acordó devolver el importe');
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
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'Pendiente');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resuelto' })).toBeDisabled();
    expect(screen.getByLabelText('Nota (opcional)')).toBeDisabled();
    reject(new Error('Sin conexión'));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('Pendiente');
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
    expect(screen.queryByLabelText('Nota (opcional)')).not.toBeInTheDocument();
  });
});
describe('editar y eliminar reclamo', () => {
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
  it('does not delete before confirmation or after cancellation', async () => {
    mount(<ReturnDelete id="claim" />);
    expect(screen.getByText(/fuera de los totales/)).toBeInTheDocument();
    expect(ctx.archiveReturn).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalledOnce();
    expect(ctx.archiveReturn).not.toHaveBeenCalled();
  });
  it('keeps the confirmation open on failure and allows retry', async () => {
    ctx.archiveReturn.mockRejectedValueOnce(new Error('No se guardó'));
    mount(<ReturnDelete id="claim" />);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó');
    expect(close).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(ctx.archiveReturn).toHaveBeenCalledTimes(2);
  });
  it('explains that an existing settlement remains recorded', () => {
    ctx.returns = [{ ...claim, status: 'RESUELTO', resolution: 'REINTEGRO' }];
    mount(<ReturnDelete id="claim" />);
    expect(screen.getByText(/Se conservan los movimientos registrados/)).toBeInTheDocument();
  });
});
