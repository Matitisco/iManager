import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { ExchangeProvider } from '../exchange';
import { Battery, DeskProvider } from '../ui';
import { EquipmentDetail, EquipmentForm } from './equipment';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[], addProduct: vi.fn(), updateProduct: vi.fn(),
  appSession: { membership: { role: 'OWNER', sections: ['inventory'] } }, suppliers: null,
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
beforeEach(() => {
  vi.clearAllMocks();
  ctx.inventory = [];
  ctx.addProduct.mockResolvedValue({ id: 'created' });
});

it.each(['alta', 'edición'])('conserva centavos al escribir y guardar un equipo: %s', async mode => {
  const editing = mode === 'edición';
  if (editing) ctx.inventory = [{ id: 'eq', model: 'iPhone 13', imei: '', capacity: '', color: '', condition: 'NUEVO', grade: '', batteryHealth: '', cost: 400, price: 600, currency: 'USD', status: 'DISPONIBLE' }];
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1250, manualSell: 1300 }}>
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <EquipmentForm id={editing ? 'eq' : undefined} busy={false} error={null} run={async action => { await action(); }} />
    </DeskProvider>
  </ExchangeProvider>);
  const user = userEvent.setup();
  if (!editing) await user.type(screen.getByPlaceholderText('Ej. iPhone 13'), 'iPhone 13');
  await user.clear(screen.getByLabelText('Costo'));
  await user.type(screen.getByLabelText('Costo'), '450,25');
  await user.clear(screen.getByPlaceholderText('A definir'));
  await user.type(screen.getByPlaceholderText('A definir'), '600.50');
  await user.click(screen.getByRole('button', { name: editing ? 'Guardar cambios' : 'Guardar equipo' }));
  await waitFor(() => expect(editing ? ctx.updateProduct : ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({ cost: 450.25, price: 600.5, currency: 'USD' })));
});

it.each(['83-85%', '0%', 'N/A'])('conserva batería %s y centavos al cambiar solo color', async batteryHealth => {
  ctx.inventory = [{ id: 'eq', model: 'iPhone 13', imei: '', capacity: '', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth, cost: 300.25, price: 450.5, currency: 'USD', status: 'DISPONIBLE' }];
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1250, manualSell: 1300 }}>
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <EquipmentForm id="eq" busy={false} error={null} run={async action => { await action(); }} />
    </DeskProvider>
  </ExchangeProvider>);
  const user = userEvent.setup();
  await user.clear(screen.getByPlaceholderText('Ej. Azul'));
  await user.type(screen.getByPlaceholderText('Ej. Azul'), 'Rojo');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(ctx.updateProduct).toHaveBeenCalledWith(expect.objectContaining({ color: 'Rojo', batteryHealth, cost: 300.25, price: 450.5, currency: 'USD' })));
});

it.each(['150', '-1', '85-83', '83-150', 'abc'])('rechaza batería inválida %s antes de guardar', async value => {
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1250, manualSell: 1300 }}><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><EquipmentForm busy={false} error={null} run={async action => { await action(); }} /></DeskProvider></ExchangeProvider>);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Ej. iPhone 13'), 'iPhone QA');
  await user.type(screen.getByPlaceholderText('A definir'), '500');
  await user.type(screen.getByPlaceholderText('Ej. 87'), value);
  await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
  expect(ctx.addProduct).not.toHaveBeenCalled();
  expect(screen.getByText('Ingresá una batería de 0 a 100 o un rango como 83-85')).toBeVisible();
});
it('guarda el rango escrito sin concatenar ni truncar sus límites', async () => {
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1250, manualSell: 1300 }}><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><EquipmentForm busy={false} error={null} run={async action => { await action(); }} /></DeskProvider></ExchangeProvider>);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Ej. iPhone 13'), 'iPhone QA');
  await user.type(screen.getByPlaceholderText('A definir'), '500');
  await user.type(screen.getByPlaceholderText('Ej. 87'), '83-85');
  await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
  expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({ batteryHealth: '83-85%' }));
});

it.each([['150%', '150%'], ['83-85%', '83-85%'], ['0.87', '87%']])('muestra batería %s igual en lista y detalle', (batteryHealth, expected) => {
  ctx.inventory = [{ id: 'eq', model: 'iPhone QA', imei: '', capacity: '', color: '', condition: 'USADO', grade: 'A', batteryHealth, cost: 300, price: 450, currency: 'USD', status: 'DISPONIBLE' }];
  render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><Battery value={batteryHealth} /><EquipmentDetail id="eq" /></DeskProvider>);
  expect(screen.getAllByText(expected)).toHaveLength(2);
});
