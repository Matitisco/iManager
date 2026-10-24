import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { SupplierDetail } from './supplier';

const api = vi.hoisted(() => ({ fetchSupplier: vi.fn(), fetchSupplierPurchase: vi.fn(), importBackendRows: vi.fn() }));
const context = vi.hoisted(() => ({
  user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER' } },
  suppliers: [], reloadInventory: vi.fn(), reloadLedger: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/suppliers-api', () => api);
vi.mock('../../services/import-api', () => ({ ...api, analyzeImport: vi.fn(), applyImportPlan: vi.fn(), analyzeInventoryText: vi.fn() }));
vi.mock('../exchange', () => ({ useMoney: () => ({ show: (value: number) => String(value) }) }));

const supplier = { id: 'sup', name: 'Mayorista Centro', deviceCount: 2, problemCount: 0, purchases: [] };
const close = vi.fn();
const toast = vi.fn();
// Keep the real shared ImportHost and its service payload/refresh chain; replace only the parser UI.
vi.mock('../../components/ImportModal', () => ({ ImportModal: ({ title, onImport, onClose }: { title: string; onImport: (rows: Record<string, string>[]) => Promise<unknown>; onClose: () => void }) => {
  const [error, setError] = React.useState('');
  return <div role="dialog" aria-label={title}><button onClick={() => { void onImport([{ model: 'iPhone 13', price: '500', cost: '300' }]).catch(error => setError(error.message)); }}>Importar equipos</button>{error ? <p role="alert">{error}</p> : null}<button onClick={onClose}>Cerrar importación</button></div>;
} }));
import React from 'react';

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSupplier.mockResolvedValue(supplier);
  api.importBackendRows.mockResolvedValue({ imported: 1, updated: 0, errors: [] });
  context.reloadInventory.mockResolvedValue(undefined);
  context.reloadLedger.mockResolvedValue(undefined);
});

describe('supplier import via the shared inventory overlay', () => {
  it('pins the supplier in the title and service payload, and refreshes the open file after success', async () => {
    render(<DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast, isStaff: false }}><SupplierDetail id="sup" /></DeskProvider>);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar stock' }));
    await userEvent.click(screen.getByRole('button', { name: /Subir listado/ }));
    const overlay = screen.getByRole('dialog', { name: 'Subir stock de Mayorista Centro' });
    expect(within(overlay).queryByRole('combobox', { name: 'Proveedor' })).not.toBeInTheDocument();
    api.fetchSupplier.mockResolvedValue({ ...supplier, deviceCount: 3, stockCount: 3 });
    await userEvent.click(within(overlay).getByRole('button', { name: 'Importar equipos' }));
    await waitFor(() => expect(api.fetchSupplier).toHaveBeenCalledTimes(2));
    expect(api.importBackendRows).toHaveBeenCalledWith(context.user, 'inventory', [expect.objectContaining({ model: 'iPhone 13', price: 500, cost: 300 })], 'sup');
    expect(context.reloadInventory).toHaveBeenCalledOnce();
    expect(context.reloadLedger).toHaveBeenCalledOnce();
    expect(screen.getByText('En stock').nextElementSibling).toHaveTextContent('3');
    fireEvent.click(within(overlay).getByRole('button', { name: 'Cerrar importación' }));
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
  it('keeps failures visible without a refresh, toast or closing the overlay', async () => {
    api.importBackendRows.mockRejectedValueOnce(new Error('No se guardó el listado'));
    render(<DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast, isStaff: false }}><SupplierDetail id="sup" /></DeskProvider>);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar stock' }));
    await userEvent.click(screen.getByRole('button', { name: /Subir listado/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Importar equipos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó el listado');
    expect(screen.getByRole('dialog', { name: 'Subir stock de Mayorista Centro' })).toBeInTheDocument();
    expect(api.fetchSupplier).toHaveBeenCalledOnce();
    expect(context.reloadInventory).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
