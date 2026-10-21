import { describe, expect, it } from 'vitest';
import {
  commissionsStandalone,
  desktopNav,
  groupPending,
  pendingDescription,
  mobileBar,
  sectionAllowed,
  sectionPending,
  type PendingInput,
} from './nav';

const pending = (patch: Partial<PendingInput> = {}): PendingInput => ({
  unread: { inventory: 0, sales: 0, tradeins: 0, clients: 0 },
  openTrades: 0,
  openRepairs: 0,
  followUps: 0,
  notifications: 0,
  commissions: 0,
  ...patch,
});

function group(role: string | null | undefined, stored: string[] | null | undefined, id: string) {
  const block = desktopNav(stored, role).main.find((item) => item.kind === 'group' && item.id === id);
  return block && block.kind === 'group' ? block.items.map((item) => item.id) : null;
}

describe('navegación por rol', () => {
  it('arma los grupos del propietario sin repetir el nombre de una sección', () => {
    const nav = desktopNav(null, 'OWNER');
    expect(nav.main.map((block) => block.kind === 'group' ? block.label : block.item.label)).toEqual([
      'Dashboard', 'Comercial', 'Stock', 'Atención', 'Finanzas', 'Análisis',
    ]);
    expect(group(null, null, 'comercial')).toEqual(['sales', 'tradeins', 'returns']);
    expect(group('OWNER', null, 'stock')).toEqual(['inventory', 'stockCount', 'publicCatalog']);
    expect(group('OWNER', null, 'atencion')).toEqual(['clients', 'followups', 'service']);
    expect(group('OWNER', null, 'finanzas')).toEqual(['cash', 'expenses', 'suppliers']);
    expect(group('OWNER', null, 'analisis')).toEqual(['reports', 'commissions', 'history']);
    expect(nav.cuenta.map((item) => item.label)).toEqual(['Notificaciones', 'Ayuda', 'Configuración']);
    const labels = nav.main.flatMap((block) => block.kind === 'group' ? [block.label, ...block.items.map((item) => item.label)] : [block.item.label]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('esconde un grupo sin secciones y deja Mis comisiones suelto', () => {
    const only = desktopNav([], 'STAFF');
    expect(commissionsStandalone([], 'STAFF')).toBe(true);
    expect(only.main.map((block) => block.kind === 'link' ? block.item.label : block.label)).toEqual(['Mis comisiones']);
    expect(only.main.some((block) => block.kind === 'group')).toBe(false);
    expect(only.cuenta.map((item) => item.id)).toEqual(['help', 'settings']);

    const staff = desktopNav(null, 'STAFF');
    expect(staff.main[0]).toMatchObject({ kind: 'link', item: { id: 'dashboard' } });
    expect(staff.main[1]).toMatchObject({ kind: 'link', item: { label: 'Mis comisiones' } });
    expect(group('STAFF', null, 'finanzas')).toEqual(['suppliers']);
    expect(group('STAFF', null, 'analisis')).toBeNull();
    expect(group('STAFF', null, 'stock')).toEqual(['inventory', 'stockCount']);
    expect(group('STAFF', null, 'stock')).not.toContain('publicCatalog');
    expect(group('STAFF', ['inventory'], 'finanzas')).toEqual(['suppliers']);
    expect(group('STAFF', [], 'finanzas')).toBeNull();
  });

  it('mete Mis comisiones en Análisis cuando hay otra sección del grupo', () => {
    expect(commissionsStandalone(['reports'], 'STAFF')).toBe(false);
    const items = group('STAFF', ['reports'], 'analisis');
    expect(items).toEqual(['reports', 'commissions']);
    const block = desktopNav(['reports'], 'STAFF').main.find((item) => item.kind === 'group' && item.id === 'analisis');
    expect(block && block.kind === 'group' ? block.items.map((item) => item.label) : []).toEqual(['Reportes', 'Mis comisiones']);
    expect(desktopNav(['reports', 'commissions'], 'MANAGER').main.some((block) => block.kind === 'link' && block.item.id === 'commissions')).toBe(false);
  });

  it('muestra Catálogo solo con el permiso y nunca en la barra', () => {
    for (const role of ['STAFF', 'MANAGER', 'OWNER']) {
      for (const stored of [null, [], ['inventory'], ['publicCatalog'], ['dashboard', 'inventory', 'sales', 'tradeins', 'publicCatalog']]) {
        const allowed = role === 'OWNER' || Boolean(stored?.includes('publicCatalog'));
        expect(sectionAllowed('publicCatalog', stored, role)).toBe(allowed);
        const stock = group(role, stored, 'stock') ?? [];
        expect(stock.includes('publicCatalog')).toBe(allowed);
        const bar = mobileBar(stored, role);
        expect(bar.map((slot) => slot.id)).not.toContain('publicCatalog');
        expect(bar.find((slot) => slot.id === 'inventory')?.activeIds.includes('publicCatalog') ?? false).toBe(allowed && bar.some((slot) => slot.id === 'inventory'));
      }
    }
  });
});

describe('pendientes de un grupo', () => {
  it('suma los pendientes de las secciones y no cuenta el resto', () => {
    const input = pending({
      unread: { inventory: 2, sales: 1, tradeins: 9, clients: 0 },
      openTrades: 2,
      openRepairs: 4,
      followUps: 3,
      notifications: 5,
      commissions: 1,
    });
    expect(sectionPending('tradeins', input)).toBe(2);
    expect(sectionPending('sales', input)).toBe(1);
    expect(sectionPending('inventory', input)).toBe(2);
    expect(groupPending(['followups', 'service', 'clients'], input)).toBe(7);
    expect(groupPending(['sales', 'tradeins', 'returns'], input)).toBe(3);
    expect(groupPending(['reports', 'commissions', 'history'], input)).toBe(1);
    expect(sectionPending('notifications', input)).toBe(5);
    expect(sectionPending('returns', input)).toBe(0);
  });
});

describe('barra del celular', () => {
  it('fija Dashboard, Ventas, Equipos y Clientes y mantiene activo el grupo', () => {
    const owner = mobileBar(null, 'OWNER');
    expect(owner.map((slot) => slot.label)).toEqual(['Dashboard', 'Ventas', 'Equipos', 'Clientes']);
    expect(owner.find((slot) => slot.id === 'sales')?.activeIds).toEqual(['sales', 'tradeins', 'returns']);
    expect(owner.find((slot) => slot.id === 'inventory')?.activeIds).toEqual(['inventory', 'stockCount', 'publicCatalog']);
    expect(owner.find((slot) => slot.id === 'clients')?.activeIds).toEqual(['clients', 'followups', 'service']);
  });

  it('abre la primera sección permitida si el ancla no está', () => {
    const bar = mobileBar(['tradeins'], 'STAFF');
    expect(bar.map((slot) => slot.id)).toEqual(['sales']);
    expect(bar[0]).toMatchObject({ label: 'Ventas', target: 'tradeins', activeIds: ['tradeins'] });
  });

  it('saca de la barra un grupo sin secciones', () => {
    expect(mobileBar(['reports'], 'STAFF').map((slot) => slot.id)).toEqual([]);
    expect(mobileBar(['clients'], 'MANAGER').map((slot) => slot.label)).toEqual(['Clientes']);
  });
});

describe('explicación de indicadores', () => {
  it('distingue avisos y operaciones conservando exactamente la suma', () => {
    const input = pending({ unread: { inventory: 2, sales: 1, tradeins: 99, clients: 3 }, openTrades: 4, openRepairs: 2, followUps: 5 });
    expect(pendingDescription(['sales', 'tradeins', 'returns'], input)).toBe('1 aviso sin leer en Ventas; 4 canjes en curso');
    expect(groupPending(['sales', 'tradeins', 'returns'], input)).toBe(5);
    expect(pendingDescription(['clients', 'followups', 'service'], input)).toBe('3 avisos sin leer en Clientes; 5 seguimientos para hoy; 2 órdenes de servicio abiertas');
    expect(pendingDescription(['inventory'], input)).toBe('2 avisos sin leer en Equipos');
  });

  it('describe solo secciones permitidas y omite ceros', () => {
    const input = pending({ openTrades: 4, openRepairs: 8, notifications: 1, commissions: 2 });
    const ids = mobileBar(['tradeins'], 'STAFF')[0]!.activeIds;
    expect(pendingDescription(ids, input)).toBe('4 canjes en curso');
    expect(pendingDescription(['clients', 'followups'], input)).toBe('');
    expect(pendingDescription(['notifications', 'commissions'], input)).toBe('1 notificación sin leer; 2 personas con comisiones pendientes');
  });
});
