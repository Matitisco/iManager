import { describe, expect, it } from 'vitest';
import { dayMonth, isRetiredRepairStatus, repairColumnStatus, repairFault, repairOverdue, repairPrice, repairStatusChangeNotice, visibleRepairStatuses } from './repairs';

describe('repair desk helpers', () => {
  it('shows the fault text, a quote when there is no budget, and overdue dates', () => {
    expect(repairFault({ fault: 'Pantalla rota', faultTags: ['Pantalla'] })).toBe('Pantalla rota');
    expect(repairFault({ fault: '  ', faultTags: ['Batería'] })).toBe('Batería');
    expect(repairPrice(145000, 'quote')).toBe('$ 145.000');
    expect(repairPrice(null, 'quote')).toBe('A cotizar');
    expect(repairPrice(null, 'dash')).toBe('—');
    expect(dayMonth('06/10/2026')).toBe('06/10');
    expect(repairOverdue({ status: 'RECIBIDO', estimatedDelivery: '01/01/2020' }, new Date(2026, 9, 8))).toBe(true);
    expect(repairOverdue({ status: 'ENTREGADO', estimatedDelivery: '01/01/2020' }, new Date(2026, 9, 8))).toBe(false);
    expect(repairOverdue({ status: 'RECIBIDO', estimatedDelivery: '31/12/2026' }, new Date(2026, 9, 8))).toBe(false);
  });

  it('hides the retired service statuses and folds those orders into Recibido', () => {
    expect(isRetiredRepairStatus('EN_DIAGNOSTICO')).toBe(true);
    expect(isRetiredRepairStatus('CUSTOM', 'Esperando respuesta')).toBe(true);
    expect(isRetiredRepairStatus('EN_REPARACION', 'En diagnóstico')).toBe(false);
    expect(repairColumnStatus('ESPERANDO_REPUESTO')).toBe('RECIBIDO');
    expect(repairColumnStatus('EN_REPARACION')).toBe('EN_REPARACION');
    const visible = visibleRepairStatuses(
      [
        { id: 'RECIBIDO', label: 'Recibido' },
        { id: 'EN_DIAGNOSTICO', label: 'En diagnóstico' },
        { id: 'EN_REPARACION', label: 'En reparación' },
      ],
      [{ status: 'ESPERANDO_RESPUESTA' }, { status: 'GARANTIA' }],
    );
    expect(visible.map((status) => status.id)).toEqual(['RECIBIDO', 'EN_REPARACION', 'GARANTIA']);
  });

  it('announces a status change and opens WhatsApp only when the order becomes ready', () => {
    const statuses = [{ id: 'LISTO_PARA_RETIRAR', label: 'Listo para retirar' }, { id: 'ENTREGADO', label: 'Entregado' }];
    expect(repairStatusChangeNotice('EN_REPARACION', {
      status: 'LISTO_PARA_RETIRAR', whatsappUrl: 'https://wa.me/549', notifyWhatsapp: true,
    }, statuses)).toEqual({
      message: 'Pasó a Listo para retirar',
      whatsappUrl: 'https://wa.me/549',
      missingPhone: false,
    });
    expect(repairStatusChangeNotice('EN_REPARACION', {
      status: 'LISTO_PARA_RETIRAR', whatsappUrl: null, notifyWhatsapp: true,
    }, statuses).missingPhone).toBe(true);
    expect(repairStatusChangeNotice('LISTO_PARA_RETIRAR', {
      status: 'ENTREGADO', whatsappUrl: 'https://wa.me/549', notifyWhatsapp: true,
    }, statuses).whatsappUrl).toBeNull();
  });
});
