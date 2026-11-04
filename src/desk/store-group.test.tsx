import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '../types/app-session';
import { groupSession } from '../test/store-group-fixtures';
import { activateStore, enableStoreGroup } from '../services/store-group-api';
import { StoreSelector, EnableStoreGroupCard } from './store-group';
import { DeskProvider } from './ui';
import { desktopNav, sectionAllowed } from './nav';
import { tabFromHash, canonicalHash } from './hash-route';

const ctx = vi.hoisted(() => ({ appSession: null as AppSession | null, user: { uid: 'firebase-test' }, applyStoreSession: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/store-group-api', () => ({ activateStore: vi.fn(), enableStoreGroup: vi.fn() }));
const toast = vi.fn();
const go = vi.fn();
function wrap(children: React.ReactNode) {
  return render(<DeskProvider value={{ tab: 'dashboard', go, toast, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), isStaff: false }}>{children}</DeskProvider>);
}
beforeEach(() => { vi.clearAllMocks(); ctx.appSession = groupSession(); });

describe('selector de tienda', () => {
  it('con una tienda suelta conserva el nombre sin desplegable ni etiqueta', () => {
    ctx.appSession!.stores = [{ ...ctx.appSession!.stores![0], kind: null, groupId: null }];
    wrap(<StoreSelector mobile />);
    expect(screen.getByTestId('mobile-store-name').tagName).toBe('SMALL');
    expect(screen.getByTestId('mobile-store-name')).toHaveTextContent('Central ficticia');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Mayorista')).not.toBeInTheDocument();
  });
  it('una membresía minorista muestra su etiqueta sin dar acceso a otra tienda', () => {
    ctx.appSession!.stores = [ctx.appSession!.stores![0]];
    ctx.appSession!.membership!.role = 'STAFF';
    wrap(<StoreSelector />);
    expect(screen.getByText('Mayorista')).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('selecciona con teclado, marca la actual y reemplaza la sesión tras cambiar', async () => {
    const user = userEvent.setup();
    const next = groupSession(); next.store = { ...next.store!, id: 'retail', name: 'Local ficticio' };
    vi.mocked(activateStore).mockResolvedValue({ session: next });
    wrap(<StoreSelector />);
    const select = screen.getByRole('combobox', { name: 'Cambiar tienda' });
    select.focus(); await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Central ficticia · Mayorista' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Local ficticio · Minorista' })).toBeVisible();
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(ctx.applyStoreSession).toHaveBeenCalledWith(next));
    expect(activateStore).toHaveBeenCalledWith(ctx.user, 'retail');
    expect(toast).toHaveBeenCalledWith('Cambiaste a Local ficticio');
  });
  it('lista mayorista primero con descripción y etiqueta de tipo, y Todas con balance combinado', () => {
    wrap(<StoreSelector />); fireEvent.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    expect(options.map(option => option.getAttribute('aria-label'))).toEqual(['Central ficticia · Mayorista', 'Local ficticio · Minorista', 'Todas las tiendas']);
    expect(options[0]).toHaveTextContent('Venta por mayor');
    expect(options[1]).toHaveTextContent('Venta al público');
    expect(options[2]).toHaveTextContent('Balance combinado');
    expect(screen.getByRole('combobox')).toHaveTextContent('Mayorista');
  });
  it('en Balance el disparador muestra Todas las tiendas', () => {
    wrap(<DeskProvider value={{ tab: 'balance', go, toast, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), isStaff: false }}><StoreSelector /></DeskProvider>);
    expect(screen.getByRole('combobox')).toHaveTextContent('Todas las tiendas');
    expect(screen.getByRole('combobox')).toHaveTextContent('Balance combinado');
  });
  it('place decide dónde vive el selector multitienda', () => {
    const { container, rerender } = wrap(<StoreSelector place="brand" />);
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    rerender(<DeskProvider value={{ tab: 'dashboard', go, toast, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), isStaff: false }}><StoreSelector place="below" /></DeskProvider>);
    expect(screen.getByRole('combobox', { name: 'Cambiar tienda' })).toBeInTheDocument();
  });
  it('Todas las tiendas abre Balance sin cambiar la activa', () => {
    wrap(<StoreSelector />); fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Todas las tiendas' }));
    expect(go).toHaveBeenCalledWith('balance'); expect(activateStore).not.toHaveBeenCalled();
  });
  it.each(['STAFF', 'MANAGER', 'unrelated', 'other-owner'])('oculta Todas las tiendas para %s', role => {
    if (role === 'unrelated') ctx.appSession!.stores![1].groupId = null;
    else if (role === 'other-owner') ctx.appSession!.stores![1].role = 'STAFF';
    else ctx.appSession!.membership!.role = role as 'STAFF' | 'MANAGER';
    wrap(<StoreSelector />); fireEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('option', { name: 'Todas las tiendas' })).not.toBeInTheDocument();
  });
  it('bloquea doble envío durante el cambio y muestra el error', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(activateStore).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    wrap(<StoreSelector />); fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Local ficticio · Minorista' }));
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('Cambiando tienda…')).toBeVisible();
    reject(new Error('No tenés acceso a esta tienda.'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('No tenés acceso a esta tienda.'));
    expect(ctx.applyStoreSession).not.toHaveBeenCalled();
  });
});

describe('activar multitienda', () => {
  beforeEach(() => { ctx.appSession!.stores = [{ ...ctx.appSession!.stores![0], kind: null, groupId: null }]; });
  it('valida nombre, confirma y aplica la sesión sin cambiar la activa', async () => {
    vi.mocked(enableStoreGroup).mockResolvedValue({ session: groupSession() });
    wrap(<EnableStoreGroupCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar multitienda' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá el nombre');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la otra tienda' }), { target: { value: ' Nuevo local ' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Esta tienda es' })); fireEvent.click(screen.getByRole('option', { name: 'Minorista' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activar multitienda' }));
    expect(enableStoreGroup).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Confirmar multitienda' })).toHaveTextContent('mayorista');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }));
    await waitFor(() => expect(ctx.applyStoreSession).toHaveBeenCalledWith(groupSession()));
    expect(enableStoreGroup).toHaveBeenCalledWith(ctx.user, { currentKind: 'RETAIL', otherStoreName: 'Nuevo local' });
    expect(toast).toHaveBeenCalledWith('Multitienda activada');
  });
  it('conserva los datos y muestra error cuando falla', async () => {
    vi.mocked(enableStoreGroup).mockRejectedValue(new Error('La tienda ya tiene un grupo.'));
    wrap(<EnableStoreGroupCard />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nuevo local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar multitienda' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La tienda ya tiene un grupo.');
    expect(ctx.applyStoreSession).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('Nuevo local');
  });
  it.each(['STAFF', 'MANAGER', 'grouped'])('no ofrece activación a %s', role => {
    if (role === 'grouped') ctx.appSession = groupSession();
    else ctx.appSession!.membership!.role = role as 'STAFF' | 'MANAGER';
    wrap(<EnableStoreGroupCard />); expect(screen.queryByText('Multitienda')).not.toBeInTheDocument();
  });
});

it('agrega la ruta y Balance después de Reportes solo para dueño de ambas', () => {
  const session = groupSession();
  expect(tabFromHash('#/analisis/balance')).toBe('balance'); expect(canonicalHash('#/analisis/balance')).toBe('#/analisis/balance');
  const nav = desktopNav(null, 'OWNER', session).main.find(block => block.kind === 'group' && block.id === 'analisis');
  expect(nav?.kind === 'group' && nav.items.slice(0, 2).map(item => item.id)).toEqual(['reports', 'balance']);
  expect(sectionAllowed('balance', ['balance'], 'OWNER', session)).toBe(true);
  expect(sectionAllowed('balance', ['balance'], 'STAFF')).toBe(false);
  expect(sectionAllowed('balance', ['balance'], 'OWNER')).toBe(false);
  session.stores![1].role = 'MANAGER';
  expect(sectionAllowed('balance', null, 'OWNER', session)).toBe(false);
});
