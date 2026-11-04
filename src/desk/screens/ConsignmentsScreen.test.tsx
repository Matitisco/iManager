import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Consignment } from '../../types';
import { DeskProvider } from '../ui';
import { ConsignmentForm, ConsignmentsScreen } from './ConsignmentsScreen';
import { desktopNav, sectionAllowed } from '../nav';
import { canonicalHash, tabFromHash } from '../hash-route';
const ctx = vi.hoisted(() => ({
  consignments: { items: [] as Consignment[] },
  consignmentsError: '',
  reloadConsignments: vi.fn(),
  loadConsignmentOptions: vi.fn(),
  addConsignments: vi.fn(),
  collectConsignment: vi.fn(),
  appSession: {
    user: { id: 'owner' },
    store: { id: 'store', currency: 'ARS' },
  },
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
const toast = vi.fn();
const close = vi.fn();
const row: Consignment = {
  id: 'entry1',
  clientId: 'diego',
  clientName: 'Diego Paz',
  phone: '11 5555-0101',
  productId: 'device1',
  deviceLabel: 'iPhone 15 · 128 GB',
  imei: '359123456321201',
  amount: 950000,
  currency: 'ARS',
  cantidad: 1,
  deliveredAt: '2026-10-12T15:00:00Z',
  daysOut: 23,
  paidAt: null,
  saleId: null,
};
function mount(form = false) {
  return render(
    <div className="desk-app">
      <DeskProvider
        value={{
          tab: 'consignments',
          go: vi.fn(),
          open: vi.fn(),
          openRecord: vi.fn(),
          close,
          toast,
          isStaff: false,
        }}
      >
        {form ? <ConsignmentForm onClose={close} /> : <ConsignmentsScreen />}
      </DeskProvider>
    </div>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  ctx.consignments = {
    items: [
      row,
      {
        ...row,
        id: 'entry2',
        productId: 'device2',
        deviceLabel: 'iPhone 14 Pro · 256 GB',
        amount: 890000,
      },
      {
        ...row,
        id: 'entry3',
        productId: 'device3',
        clientId: 'marcos',
        clientName: 'Marcos Giménez',
        amount: 1200000,
      },
    ],
  };
  ctx.consignmentsError = '';
  ctx.loadConsignmentOptions.mockResolvedValue({
    clients: [{ id: 'diego', name: 'Diego Paz', phone: null }],
    products: [
      {
        id: 'device1',
        model: 'iPhone 15',
        capacity: '128 GB',
        cantidad: 1,
        imei: '359123456321201',
        price: 950000,
        currency: 'ARS',
      },
    ],
  });
  ctx.addConsignments.mockResolvedValue(undefined);
  ctx.collectConsignment.mockResolvedValue(undefined);
});
it.each(['light', 'dark'])(
  'renderiza tarjetas por persona, totales, equipos y antigüedad en %s',
  (theme) => {
    document.documentElement.dataset.theme = theme;
    mount();
    expect(screen.getAllByRole('region')).toHaveLength(2);
    const diego = screen.getByRole('region', {
      name: 'Consignaciones de Diego Paz',
    });
    expect(within(diego).getByText('$ 1.840.000')).toBeVisible();
    expect(within(diego).getByText('iPhone 15 · 128 GB')).toBeVisible();
    expect(within(diego).getAllByText(/23 días/)).toHaveLength(2);
    expect(screen.getByText('$ 3.040.000')).toBeVisible();
    expect(
      within(diego).getAllByRole('button', { name: /Marcar pagada/ }),
    ).toHaveLength(2);
    delete document.documentElement.dataset.theme;
  },
);
it('busca por persona/equipo y expande más de tres equipos', async () => {
  ctx.consignments.items = Array.from({ length: 4 }, (_, i) => ({
    ...row,
    id: `entry${i}`,
    deviceLabel: `iPhone ${i + 12}`,
  }));
  mount();
  expect(screen.queryByText('iPhone 15')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Ver todas (4)' }));
  expect(screen.getByText('iPhone 15')).toBeVisible();
  await userEvent.type(
    screen.getAllByPlaceholderText('Buscar persona o equipo')[0],
    'sin coincidencia',
  );
  expect(
    screen.getByText('No encontramos consignaciones con esa búsqueda.'),
  ).toBeVisible();
});
it('cobra el importe total y conserva el formulario ante fallo', async () => {
  ctx.collectConsignment.mockRejectedValueOnce(
    new Error('Abrí la caja para hoy'),
  );
  mount();
  await userEvent.click(
    screen.getAllByRole('button', {
      name: `Marcar pagada ${row.deviceLabel}`,
    })[0],
  );
  await userEvent.selectOptions(
    screen.getByLabelText('Medio de pago'),
    'TRANSFERENCIA',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Registrar cobro' }),
  );
  expect(ctx.collectConsignment).toHaveBeenCalledWith(row.id, 'TRANSFERENCIA');
  expect(screen.getByRole('alert')).toHaveTextContent('Abrí la caja para hoy');
  expect(screen.getByRole('dialog')).toBeVisible();
  await userEvent.click(
    screen.getByRole('button', { name: 'Registrar cobro' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('crea para un cliente existente con precio acordado y no cierra si falla', async () => {
  ctx.addConsignments.mockRejectedValueOnce(
    new Error('El equipo ya está en consignación'),
  );
  mount(true);
  await screen.findByText('iPhone 15 · 128 GB');
  await userEvent.selectOptions(screen.getByLabelText('Cliente'), 'diego');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.clear(screen.getByLabelText('Precio de iPhone 15'));
  await userEvent.type(screen.getByLabelText('Precio de iPhone 15'), '940.000');
  await userEvent.click(
    screen.getByRole('button', { name: 'Crear consignación' }),
  );
  expect(ctx.addConsignments).toHaveBeenCalledWith({
    clientId: 'diego',
    items: [{ productId: 'device1', amount: 940000, currency: 'ARS' }],
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'El equipo ya está en consignación',
  );
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Crear consignación' }),
  );
  expect(close).toHaveBeenCalledOnce();
});
it('bloquea doble cobro mientras espera persistencia', async () => {
  let resolve!: () => void;
  ctx.collectConsignment.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  mount();
  await userEvent.click(
    screen.getAllByRole('button', {
      name: `Marcar pagada ${row.deviceLabel}`,
    })[0],
  );
  await userEvent.dblClick(
    screen.getByRole('button', { name: 'Registrar cobro' }),
  );
  expect(ctx.collectConsignment).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
  resolve();
});
it('ofrece Consignaciones en Comercial y hereda permisos de Ventas', () => {
  const group = desktopNav(null, 'OWNER').main.find(
    (block) => block.kind === 'group' && block.id === 'comercial',
  );
  expect(
    group?.kind === 'group' && group.items.map((item) => item.label),
  ).toEqual(['Ventas', 'Consignaciones', 'Canjes', 'Devoluciones']);
  expect(tabFromHash('#/comercial/consignaciones')).toBe('consignments');
  expect(canonicalHash('#/comercial/consignaciones')).toBe(
    '#/comercial/consignaciones',
  );
  expect(sectionAllowed('consignments', ['sales'], 'STAFF')).toBe(true);
  expect(sectionAllowed('consignments', ['inventory'], 'STAFF')).toBe(false);
});
