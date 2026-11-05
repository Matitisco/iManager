import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const open = vi.fn();
function wrap(children: React.ReactNode) {
  return render(<DeskProvider value={{ tab: 'dashboard', go, toast, open, openRecord: vi.fn(), close: vi.fn(), isStaff: false }}>{children}</DeskProvider>);
}
beforeEach(() => { vi.clearAllMocks(); ctx.appSession = groupSession(); });

describe('selector de tienda', () => {
  it.each([false, true])(
    'con una tienda suelta muestra D1 con avatar neutro y sin pill (mobile=%s)',
    (mobile) => {
      ctx.appSession!.stores = [
        { ...ctx.appSession!.stores![0], kind: null, groupId: null },
      ];
      wrap(<StoreSelector mobile={mobile} />);
      const trigger = screen.getByTestId(
        mobile ? 'mobile-store-name' : 'store-selector',
      );
      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveTextContent('Central ficticia');
      expect(trigger.closest('.store-selector')).toHaveClass('multi');
      expect(trigger.querySelector('.store-tile')).toHaveClass('generic');
      expect(trigger.querySelector('.store-tile')).not.toHaveClass('wholesale');
      fireEvent.click(trigger);
      const current = screen.getByRole('option', { name: 'Central ficticia' });
      expect(current).toHaveAttribute('aria-selected', 'true');
      expect(current.querySelector('.store-pill')).toBeNull();
      expect(
        screen.getByRole('option', { name: 'Agregar tienda' }),
      ).toBeVisible();
    },
  );
  it.each(['STAFF', 'MANAGER'] as const)(
    'una membresía %s muestra su tienda y tipo sin agregar ni balance',
    (role) => {
      ctx.appSession!.stores = [
        { ...ctx.appSession!.stores![0], groupId: null, role },
      ];
      ctx.appSession!.membership!.role = role;
      wrap(<StoreSelector />);
      expect(screen.getByRole('combobox')).toHaveTextContent('Mayorista');
      fireEvent.click(screen.getByRole('combobox'));
      expect(screen.getAllByRole('option')).toHaveLength(1);
      expect(
        screen.getByRole('option', { name: 'Central ficticia · Mayorista' }),
      ).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.queryByRole('option', { name: 'Agregar tienda' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: 'Todas las tiendas' }),
      ).not.toBeInTheDocument();
    },
  );
  it('Agregar tienda abre un sheet vacío sin abrir Configuración ni cambiar tienda', async () => {
    ctx.appSession!.stores = [{ ...ctx.appSession!.stores![0], groupId: null }];
    const user = userEvent.setup();
    wrap(<StoreSelector />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}{End}{Enter}');
    const sheet = screen.getByRole('dialog', { name: 'Agregar tienda' });
    expect(open).not.toHaveBeenCalled();
    expect(within(sheet).getByRole('textbox', { name: 'Nombre' })).toHaveValue('');
    expect(within(sheet).getByRole('textbox', { name: 'Nombre' })).toHaveAttribute('maxLength', '120');
    expect(within(sheet).getByRole('textbox', { name: 'Dirección' })).toHaveValue('');
    expect(within(sheet).getByRole('textbox', { name: 'Instagram' })).toHaveValue('');
    expect(within(sheet).getByRole('combobox', { name: 'Tipo de la nueva tienda' })).toHaveTextContent('Seleccionar');
    expect(within(sheet).getAllByRole('textbox')).toHaveLength(3);
    expect(within(sheet).queryByText(/moneda|cotización|Activar multitienda/i)).not.toBeInTheDocument();
    expect(activateStore).not.toHaveBeenCalled();
    expect(enableStoreGroup).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('usa la tienda de sesión si la lista de membresías todavía no está disponible', () => {
    ctx.appSession!.stores = undefined;
    wrap(<StoreSelector />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Central ficticia' }));
    expect(activateStore).not.toHaveBeenCalled();
    expect(ctx.applyStoreSession).not.toHaveBeenCalled();
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
  it.each([1, 2])('place muestra una sola tarjeta debajo de la marca con %s tiendas', count => {
    ctx.appSession!.stores = ctx.appSession!.stores!.slice(0, count);
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


describe('agregar tienda desde el selector', () => {
  beforeEach(() => {
    ctx.appSession!.stores = [{ ...ctx.appSession!.stores![0], kind: null, groupId: null }];
  });
  function showSheet(mobile = false) {
    wrap(<StoreSelector mobile={mobile} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Cambiar tienda' }));
    fireEvent.click(screen.getByRole('option', { name: 'Agregar tienda' }));
    return screen.getByRole('dialog', { name: 'Agregar tienda' });
  }
  function fill(kind: 'Mayorista' | 'Minorista' = 'Minorista') {
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), {
      target: { value: ' Sucursal Norte ficticia ' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo de la nueva tienda' }));
    fireEvent.click(screen.getByRole('option', { name: kind }));
  }
  function sessions(newKind: 'WHOLESALE' | 'RETAIL' = 'RETAIL') {
    const enabled = groupSession();
    enabled.stores![0].kind = newKind === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE';
    enabled.stores![1] = {
      ...enabled.stores![1],
      kind: newKind,
      name: 'Sucursal Norte ficticia',
    };
    const active = {
      ...enabled,
      store: { ...enabled.store!, id: 'retail', name: 'Sucursal Norte ficticia' },
    };
    vi.mocked(enableStoreGroup).mockResolvedValue({ session: enabled });
    vi.mocked(activateStore).mockResolvedValue({ session: active });
    return { enabled, active };
  }
  it.each([
    {
      kind: 'Minorista' as const,
      value: 'RETAIL' as const,
      opposite: 'WHOLESALE',
      label: 'mayorista',
    },
    {
      kind: 'Mayorista' as const,
      value: 'WHOLESALE' as const,
      opposite: 'RETAIL',
      label: 'minorista',
    },
  ])(
    'crea la nueva $kind y la selecciona con el tipo actual opuesto',
    async ({ kind, value, opposite, label }) => {
      const { active } = sessions(value);
      showSheet();
      fill(kind);
      expect(
        screen.getByText(
          `Tu tienda actual «Central ficticia» quedará como ${label}.`,
        ),
      ).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
      await waitFor(() =>
        expect(ctx.applyStoreSession).toHaveBeenCalledWith(active),
      );
      expect(enableStoreGroup).toHaveBeenCalledExactlyOnceWith(ctx.user, {
        currentKind: opposite,
        otherStoreName: 'Sucursal Norte ficticia',
      });
      expect(activateStore).toHaveBeenCalledExactlyOnceWith(ctx.user, 'retail');
      expect(enableStoreGroup).toHaveBeenCalledBefore(vi.mocked(activateStore));
      expect(toast).toHaveBeenCalledWith(
        'Listo, estás en Sucursal Norte ficticia',
      );
      expect(go).toHaveBeenCalledWith('dashboard');
      expect(open).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('dialog', { name: 'Agregar tienda' }),
      ).not.toBeInTheDocument();
    },
  );
  it('envía dirección e Instagram de la nueva tienda en la misma alta', async () => {
    sessions();
    showSheet();
    fill();
    fireEvent.change(screen.getByRole('textbox', { name: 'Dirección' }), {
      target: { value: ' Calle Ficticia 123 ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Instagram' }), {
      target: { value: ' @sucursal.ficticia ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
    await waitFor(() => expect(activateStore).toHaveBeenCalled());
    expect(enableStoreGroup).toHaveBeenCalledWith(ctx.user, {
      currentKind: 'WHOLESALE',
      otherStoreName: 'Sucursal Norte ficticia',
      otherAddress: 'Calle Ficticia 123',
      otherInstagram: '@sucursal.ficticia',
    });
  });
  it('nombre vacío muestra un error y no llama a la API', () => {
    showSheet();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ingresá el nombre de la nueva tienda.',
    );
    expect(enableStoreGroup).not.toHaveBeenCalled();
    expect(activateStore).not.toHaveBeenCalled();
  });
  it('requiere elegir el tipo de la nueva tienda', () => {
    showSheet();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), {
      target: { value: 'Sucursal Norte ficticia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Elegí si la nueva tienda es minorista o mayorista.',
    );
    expect(enableStoreGroup).not.toHaveBeenCalled();
  });
  it('conserva el formulario y muestra la validación amable del backend', async () => {
    vi.mocked(enableStoreGroup).mockRejectedValueOnce(
      new Error('Usá @usuario o el link del perfil'),
    );
    showSheet();
    fill();
    fireEvent.change(screen.getByRole('textbox', { name: 'Instagram' }), {
      target: { value: 'mi tienda' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Usá @usuario o el link del perfil',
    );
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue(
      ' Sucursal Norte ficticia ',
    );
    expect(screen.getByRole('textbox', { name: 'Instagram' })).toHaveValue(
      'mi tienda',
    );
    expect(activateStore).not.toHaveBeenCalled();
    expect(ctx.applyStoreSession).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
  it('reintenta solo la selección si la tienda ya se creó y no duplica el alta', async () => {
    const { enabled, active } = sessions();
    vi.mocked(activateStore).mockRejectedValueOnce(
      new Error('No se pudo cambiar de tienda.'),
    );
    showSheet();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La tienda ya está creada.',
    );
    expect(ctx.applyStoreSession).toHaveBeenCalledWith(enabled);
    ctx.appSession = enabled;
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar tienda' }));
    await waitFor(() =>
      expect(ctx.applyStoreSession).toHaveBeenLastCalledWith(active),
    );
    expect(enableStoreGroup).toHaveBeenCalledTimes(1);
    expect(activateStore).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('dialog', { name: 'Agregar tienda' }),
    ).not.toBeInTheDocument();
  });
  it('bloquea doble envío y cierre durante la creación', async () => {
    let resolve!: (value: { session: AppSession }) => void;
    const { enabled } = sessions();
    vi.mocked(enableStoreGroup).mockImplementationOnce(
      () => new Promise((done) => {
        resolve = done;
      }),
    );
    showSheet();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.submit(document.getElementById('add-store-form')!);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.getByRole('dialog', { name: 'Agregar tienda' }),
    ).toBeInTheDocument();
    expect(enableStoreGroup).toHaveBeenCalledTimes(1);
    resolve({ session: enabled });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Agregar tienda' }),
      ).not.toBeInTheDocument(),
    );
  });
  it('no permite crear con la cuenta en solo lectura', () => {
    ctx.appSession!.billing = { readOnly: true } as NonNullable<
      AppSession['billing']
    >;
    showSheet();
    fill();
    expect(screen.getByRole('button', { name: 'Crear tienda' })).toBeDisabled();
    fireEvent.submit(document.getElementById('add-store-form')!);
    expect(enableStoreGroup).not.toHaveBeenCalled();
  });
  it('Cancelar descarta el formulario y vuelve a abrir vacío', () => {
    showSheet();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Cambiar tienda' }));
    fireEvent.click(screen.getByRole('option', { name: 'Agregar tienda' }));
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('');
    expect(enableStoreGroup).not.toHaveBeenCalled();
  });
  it('en móvil abre el sheet dedicado desde Tus tiendas y permite crear y seleccionar', async () => {
    const media = vi.mocked(window.matchMedia);
    const matchMedia = media.getMockImplementation()!;
    media.mockImplementation((query) => ({
      ...matchMedia(query),
      matches: query === '(max-width: 760px)',
    }));
    try {
      const { active } = sessions();
      const sheet = showSheet(true);
      expect(sheet.querySelector('.sheet-grab')).not.toBeNull();
      expect(
        screen.queryByRole('dialog', { name: 'Tus tiendas' }),
      ).not.toBeInTheDocument();
      fill();
      fireEvent.click(screen.getByRole('button', { name: 'Crear tienda' }));
      await waitFor(() =>
        expect(ctx.applyStoreSession).toHaveBeenCalledWith(active),
      );
      expect(
        screen.queryByRole('dialog', { name: 'Agregar tienda' }),
      ).not.toBeInTheDocument();
    } finally {
      media.mockImplementation(matchMedia);
    }
  });
});

describe('activar multitienda', () => {
  beforeEach(() => { ctx.appSession!.stores = [{ ...ctx.appSession!.stores![0], kind: null, groupId: null }]; });
  it('desplaza y enfoca la tarjeta solicitada sin activar multitienda', async () => {
    const scroll = vi.fn();
    const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      wrap(<EnableStoreGroupCard autoFocus />);
      const card = screen.getByRole('region', { name: 'Multitienda' });
      await waitFor(() => expect(card).toHaveFocus());
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
      expect(within(card).getByRole('textbox')).toHaveValue('');
      expect(enableStoreGroup).not.toHaveBeenCalled();
    } finally { HTMLElement.prototype.scrollIntoView = previous; }
  });
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
