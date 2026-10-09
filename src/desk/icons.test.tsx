import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeskIcon } from './ui';
import { IMANAGER_ICON_NAMES, ImanagerIcon, nearestIconSize, notificationIcon, statusIcon } from './icons';

describe('iManager icons', () => {
  it('renders the custom set at 16, 20 and 24, with the active fill class', () => {
    const { rerender } = render(<ImanagerIcon name="equipo" size={16} />);
    const icon = () => document.querySelector('svg.ic') as SVGElement;
    expect(icon()).toHaveAttribute('data-icon', 'equipo');
    expect(icon()).toHaveAttribute('width', '16');
    expect(icon()).toHaveAttribute('data-active', 'false');
    expect(icon().querySelector('.ic-accent')).toBeTruthy();

    rerender(<ImanagerIcon name="novedad" size={20} active />);
    expect(icon()).toHaveAttribute('width', '20');
    expect(icon()).toHaveClass('ic', 'act');

    rerender(<ImanagerIcon name="cerrar" size={24} />);
    expect(icon()).toHaveAttribute('width', '24');
    expect(IMANAGER_ICON_NAMES).toHaveLength(22);
    expect(nearestIconSize(15)).toBe(16);
    expect(nearestIconSize(18)).toBe(20);
    expect(nearestIconSize(22)).toBe(24);
  });

  it('maps status chips and leaves the side navigation glyphs untouched', () => {
    expect(statusIcon('DISPONIBLE')).toBe('disponible');
    expect(statusIcon('RESERVADO')).toBe('reservado');
    expect(statusIcon('EN_REVISION')).toBe('en-revision');
    expect(statusIcon('En revisión')).toBe('en-revision');
    expect(statusIcon('VENDIDO')).toBe('vendido');
    expect(statusIcon('PERITAJE TÉC.')).toBe('servicio-tecnico');
    expect(statusIcon('VIP')).toBeNull();

    const { rerender } = render(<DeskIcon name="list" size={22} />);
    const glyph = () => document.querySelector('svg') as SVGElement;
    expect(glyph()).toHaveAttribute('data-desk-icon', 'list');
    expect(glyph()).not.toHaveAttribute('data-icon');
    expect(glyph()).toHaveAttribute('width', '22');

    rerender(<DeskIcon name="bell" size={18} />);
    expect(glyph()).toHaveAttribute('data-desk-icon', 'bell');

    rerender(<DeskIcon name="edit" size={15} />);
    expect(glyph()).toHaveAttribute('data-icon', 'editar');
    expect(glyph()).toHaveAttribute('width', '16');
  });

  it('picks the icon of what the notification is about', () => {
    expect(notificationIcon({ section: 'tradeins', title: 'Nuevo canje pendiente' })).toBe('canje');
    expect(notificationIcon({ section: 'sales', title: 'Venta registrada' })).toBe('venta-por-registrar');
    expect(notificationIcon({ section: 'inventory', title: 'Equipo en revisión', message: 'iPhone 14 Pro' })).toBe('equipo');
    expect(notificationIcon({ section: 'inventory', title: 'Equipo vendido', message: 'iPhone 13 vendido' })).toBe('vendido');
    expect(notificationIcon({ section: 'clients', title: 'Socio Ejemplo se unió' })).toBe('cliente');
    expect(notificationIcon({ section: 'inventory', title: 'Venta manual por registrar', kind: 'MANUAL_SOLD_PENDING' })).toBe('venta-por-registrar');
    expect(notificationIcon({ section: 'other', title: 'Aviso' })).toBe('novedad');
  });

  it('gives the technical service statuses the designed glyphs', () => {
    expect(statusIcon('EN_DIAGNOSTICO')).toBe('en-revision');
    expect(statusIcon('ESPERANDO_REPUESTO')).toBe('reservado');
    expect(statusIcon('EN_REPARACION')).toBe('servicio-tecnico');
    expect(statusIcon('LISTO_PARA_RETIRAR')).toBe('disponible');
    expect(statusIcon('RECIBIDO')).toBeNull();
    expect(statusIcon('ENTREGADO')).toBeNull();
  });
});
