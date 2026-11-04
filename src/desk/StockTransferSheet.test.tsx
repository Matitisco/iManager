import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AppSession } from '../types/app-session';
import type { Product } from '../types';
import { groupSession } from '../test/store-group-fixtures';
import { transferStock } from '../services/store-group-api';
import { DeskProvider } from './ui';
import { StockTransferSheet, TransferStockAction, transferUnavailable } from './StockTransferSheet';
import { useBulkSelection } from './bulk-selection';
const ctx = vi.hoisted(() => ({ appSession: null as AppSession | null, user: { uid: 'firebase-test' }, reloadInventory: vi.fn(), backendStatus: 'ready' }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/store-group-api', () => ({ transferStock: vi.fn() }));
const cable: Product = { id: 'cable', kind: 'ACCESSORY', model: 'Cable ficticio', cantidad: 5, imei: '', capacity: '', color: '', condition: '', grade: '', batteryHealth: '', cost: 12345, price: 20000, status: 'DISPONIBLE' };
const device: Product = { ...cable, id: 'device', kind: 'DEVICE', model: 'Celular ficticio', cantidad: 3, imei: '123456789012345' };
const close = vi.fn(), success = vi.fn(), toast = vi.fn();
const receipt = { id: 'transfer', createdAt: '2026-11-04T12:00:00Z', from: { id: 'wholesale', name: 'Central ficticia' }, to: { id: 'retail', name: 'Local ficticio' }, items: [{ label: 'Cable ficticio', quantity: 3 }] };
function wrap(children?: React.ReactNode) {
  return render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast, isStaff: false }}>{children ?? <StockTransferSheet items={[cable, device]} destination={groupSession().stores![1]} onClose={close} onSuccess={success} />}</DeskProvider>);
}
beforeEach(() => { vi.clearAllMocks(); ctx.appSession = groupSession(); ctx.reloadInventory.mockResolvedValue(undefined); vi.mocked(transferStock).mockResolvedValue({ transfer: receipt }); });
it('muestra destino y aviso a costo sin revelar costos; valida el máximo', async () => {
  wrap(); expect(screen.getByText(/Se mueve a costo/)).toBeVisible(); expect(screen.queryByText(/12.345/)).not.toBeInTheDocument();
  const quantity = screen.getByRole('spinbutton', { name: 'Cantidad de Cable ficticio' });
  expect(quantity).toHaveAttribute('max', '5');
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de Celular ficticio' })).toBeDisabled();
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de Celular ficticio' })).toHaveValue(1);
  for (const value of ['6', '0', '1.5', '']) {
    fireEvent.change(quantity, { target: { value } }); fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
    expect(screen.getByRole('alert')).toHaveTextContent('cantidad entera'); expect(transferStock).not.toHaveBeenCalled();
  }
  fireEvent.change(quantity, { target: { value: '3' } }); fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(transferStock).toHaveBeenCalledWith(ctx.user, { toStoreId: 'retail', items: [{ inventoryItemId: 'cable', quantity: 3 }, { inventoryItemId: 'device', quantity: 1 }], requestKey: expect.stringMatching(/^[\w-]{36}$/) });
  expect(ctx.reloadInventory).toHaveBeenCalledOnce(); expect(toast).toHaveBeenCalledWith('3 unidades transferidas a Local ficticio');
});
it('conserva hoja y requestKey al reintentar un error y evita doble envío', async () => {
  vi.mocked(transferStock).mockRejectedValueOnce(new Error('El equipo está reservado.'));
  wrap(); fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El equipo está reservado.');
  expect(success).not.toHaveBeenCalled(); expect(ctx.reloadInventory).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Transferir' })); fireEvent.click(screen.getByRole('button', { name: 'Procesando…' }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(transferStock).toHaveBeenCalledTimes(2);
  expect(vi.mocked(transferStock).mock.calls[0][1]).toEqual(vi.mocked(transferStock).mock.calls[1][1]);
});
it('no vuelve a transferir cuando solo falló la recarga', async () => {
  ctx.reloadInventory.mockRejectedValueOnce(new Error('Sin conexión'));
  wrap(); fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La transferencia se guardó');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar inventario' }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce()); expect(transferStock).toHaveBeenCalledOnce();
});
it('cada apertura tiene una clave distinta', async () => {
  const first = wrap(); fireEvent.click(screen.getByRole('button', { name: 'Transferir' })); await waitFor(() => expect(success).toHaveBeenCalledOnce());
  first.unmount(); wrap(); fireEvent.click(screen.getByRole('button', { name: 'Transferir' })); await waitFor(() => expect(success).toHaveBeenCalledTimes(2));
  expect(vi.mocked(transferStock).mock.calls[0][1].requestKey).not.toBe(vi.mocked(transferStock).mock.calls[1][1].requestKey);
});
it('no envía a un destino ajeno al grupo', () => {
  ctx.appSession!.stores![1].groupId = 'other'; wrap();
  expect(screen.getByRole('button', { name: 'Transferir' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Transferir' })); expect(transferStock).not.toHaveBeenCalled();
});
it.each([{ archivedAt: '2026-11-04' }, { reservedDepositId: 'deposit' }, { status: 'VENDIDO' }, { status: 'EN_CONSIGNACION' }, { pendingSaleRegistration: true }, { cantidad: 0 }, { cantidad: 0, imei: '123456789012345' }])('no ofrece transferir stock no disponible: %j', flags => {
  expect(transferUnavailable({ ...cable, ...flags })).toBe(true);
});
function Action() {
  const selection = useBulkSelection([cable], 'test');
  return <><button type="button" onClick={() => selection.start(cable.id)}>Seleccionar</button><TransferStockAction selection={selection} /><span data-testid="selected">{selection.selected.length}</span></>;
}
it('abre desde selección y la limpia al transferir', async () => {
  wrap(<Action />); fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Transferir a Local ficticio' })); expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Transferir' })); await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('0'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it.each(['STAFF', 'MANAGER'])('oculta la acción al rol %s aunque tenga grupo', role => {
  ctx.appSession!.membership!.role = role as 'STAFF' | 'MANAGER'; wrap(<Action />);
  expect(screen.queryByRole('button', { name: 'Transferir a Local ficticio' })).not.toBeInTheDocument();
});
