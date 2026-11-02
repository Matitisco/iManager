import { describe, expect, it } from 'vitest';
import { auditDescription, eventDescription, historyRole } from './activity-events.js';

describe('marketing action descriptions', () => {
  it.each([
    ['excel_import_succeeded', { rows: 12 }, 'Cargó 12 equipos por Excel'],
    ['excel_import_succeeded', { rows: 1 }, 'Cargó 1 equipo por Excel'],
    ['excel_import_succeeded', { rows: 'private client' }, 'Cargó equipos por Excel'],
    ['sale_created', { total: 12345, client_name: 'Cliente secreto', phone: '1234567' }, 'Registró una venta'],
    ['employee_invite_sent', {}, 'Invitó a un empleado'],
    ['user_logged_in', {}, 'Inició sesión'],
    ['$pageview', { url: 'https://example.test/#/dashboard' }, 'Abrió Dashboard'],
    ['$pageview', { url: 'https://example.test/#/atencion/clientes?name=Privado' }, 'Abrió Clientes'],
    ['$pageview', { url: 'https://example.test/client/Privado' }, 'Abrió la app'],
  ])('maps %s using only safe properties', (name, props, text) => {
    expect(eventDescription(name, props, 'posthog')?.text).toBe(text);
  });
  it('keeps unsupported events out and daily activity honest', () => {
    expect(eventDescription('$autocapture', { text: 'secret' }, 'posthog')).toBeNull();
    expect(eventDescription('active_day', {}, 'product')?.text).toBe('Entró a la app');
    expect(auditDescription('sale.created').text).toBe('Registró una venta');
    expect(auditDescription('client.updated')).toMatchObject({ text: 'Editó un cliente', type: 'other' });
    expect(historyRole('OWNER')).toBe('Dueño');
    expect(historyRole('STAFF')).toBe('Empleado');
    expect(historyRole('arbitrary private value')).toBeNull();
  });
  it('separates failed imports from successful operations', () => {
    expect(eventDescription('stock_import_finished', { ok: false, method: 'excel' }, 'product')).toMatchObject({ operation: 'import_failed', text: 'La carga de equipos no terminó' });
  });
});
