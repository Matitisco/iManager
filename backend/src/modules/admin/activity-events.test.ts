import { describe, expect, it } from 'vitest';
import { auditActions, auditDescription, eventDescription, historyRole } from './activity-events.js';

describe('store action descriptions', () => {
  it.each([
    ['excel_import_succeeded', { rows: 12 }, 'Cargó 12 equipos por Excel'],
    ['excel_import_succeeded', { rows: 1 }, 'Cargó 1 equipo por Excel'],
    ['excel_import_succeeded', { rows: 'private client' }, 'Cargó equipos por Excel'],
    ['sale_created', { total: 12345, client_name: 'Cliente secreto', phone: '1234567' }, 'Registró una venta'],
    ['employee_invite_sent', {}, 'Invitó a un empleado'],
    ['user_logged_in', {}, 'Se conectó'],
  ])('maps %s using only safe properties', (name, props, text) => {
    expect(eventDescription(name, props, 'posthog')?.text).toBe(text);
  });
  it.each(['$pageview', '$autocapture', 'screen_opened', 'button_clicked', 'signup_completed', 'first_device_added', 'excel_import_failed'])('excludes %s', name => {
    expect(eventDescription(name, { url: 'https://example.test/#/dashboard', text: 'secret' }, 'posthog')).toBeNull();
  });
  it.each(['signup', 'stock_import_abandoned', 'app_installed', 'first_steps_finished', 'first_sale', 'onboarding_completed'])('excludes product milestone %s', name => {
    expect(eventDescription(name, {}, 'product')).toBeNull();
  });
  it('only includes saved imports and describes daily connections', () => {
    expect(eventDescription('stock_import_finished', { ok: false }, 'product')).toBeNull();
    expect(eventDescription('stock_import_finished', {}, 'product')).toBeNull();
    expect(eventDescription('excel_import_succeeded', { rows: 0 }, 'posthog')).toBeNull();
    expect(eventDescription('stock_import_finished', { ok: true, rows: '2-10', method: 'excel' }, 'product')?.text).toBe('Cargó entre 2 y 10 equipos por Excel');
    expect(eventDescription('active_day', {}, 'product')).toMatchObject({ type: 'connection', text: 'Se conectó' });
    expect(historyRole('OWNER')).toBe('Dueño');
    expect(historyRole('STAFF')).toBe('Empleado');
    expect(historyRole('arbitrary private value')).toBeNull();
  });
  it.each(['inventory', 'sale', 'client', 'trade', 'repair', 'return'])('classifies %s loads, removals and edits', domain => {
    expect(auditDescription(`${domain}.created`)?.type).toBe('create');
    expect(auditDescription(`${domain}.updated`)?.type).toBe('update');
    expect(auditDescription(`${domain}.${['sale', 'trade'].includes(domain) ? 'voided' : 'archived'}`)?.type).toBe('delete');
    expect(auditDescription(`${domain}.restored`)?.type).toBe('update');
  });
  it('classifies employees/settings and includes actual return/repair actions absent from the shared catalog', () => {
    for (const action of ['member.invited', 'member.joined']) expect(auditDescription(action)?.type).toBe('create');
    for (const action of ['member.removed', 'invitation.cancelled', 'return.cancelled', 'category.archived']) expect(auditDescription(action)?.type).toBe('delete');
    for (const action of ['member.role', 'member.permissions', 'store.updated', 'catalog.visibility', 'repair.estimate']) expect(auditDescription(action)?.type).toBe('update');
  });
  it('filters unknown actions, other modules and financial movements even without a type filter', () => {
    for (const action of ['unknown.created', 'expense.created', 'cash.opened', 'supplier.updated', 'stockcount.opened', 'sale.payment', 'client.deposit', 'credit.applied']) {
      expect(auditDescription(action)).toBeNull();
      expect(auditActions()).not.toContain(action);
    }
    expect(auditActions('connection')).toEqual([]);
    expect(auditActions('update')).toContain('client.updated');
    expect(auditActions('delete')).not.toContain('client.restored');
  });
  it('describes only known field names, never stored values, free-form labels or internal metadata', () => {
    expect(auditDescription('client.updated', ['name', 'phone', 'name', '_batchId', 'Cliente privado', '__proto__', {}])?.text).toBe('Editó un cliente · Campos: Nombre, Teléfono');
    expect(auditDescription('client.updated', null)?.text).toBe('Editó un cliente');
    expect(auditDescription('inventory.created', ['price'])?.text).toBe('Registró un equipo');
  });
});
