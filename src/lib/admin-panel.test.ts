import { describe, expect, it } from 'vitest';
import { describeEvent, groupTimeline, timelineMilestones, medianDuration, PANEL_STEPS, type TimelineEvent } from './admin-panel';
const event = (name: string, at: string, props = {}): TimelineEvent => ({ name, at, props, source: 'server', label: '' });
describe('admin timeline', () => {
  it('groups newest first by Argentine day, collapses consecutive entries and keeps separated activity', () => {
    const groups = groupTimeline([
      event('active_day', '2026-10-18T02:00:00Z', { device: 'phone' }),
      event('active_day', '2026-10-18T02:30:00Z', { device: 'desktop' }),
      event('invite_created', '2026-10-18T02:40:00Z', { role: 'STAFF' }),
      event('active_day', '2026-10-18T02:50:00Z', { device: 'phone' }),
      event('app_installed', '2026-10-18T13:00:00Z'),
      event('signup', '2026-10-16T17:00:00Z', { provider: 'google' }),
    ], new Date('2026-10-18T15:00:00Z'));
    expect(groups.map(g => g.label)).toEqual(['Hoy', 'Ayer', 'Vie 16/10']);
    expect(groups[1].entries.map(e => e.text)).toEqual(['Entró · celular', 'Invitó a un Empleado', 'Entró · compu · celular']);
  });
  it('maps all event names and derived milestones, with Spanish props and generic unknowns', () => {
    const names = ['signup', 'onboarding_name_viewed', 'onboarding_name_completed', 'onboarding_stock_viewed', 'stock_method_chosen', 'stock_import_finished', 'stock_import_abandoned', 'sample_stock_loaded', 'sample_stock_deleted', 'onboarding_completed', 'first_step_completed', 'first_steps_opened', 'first_steps_step_clicked', 'first_steps_finished', 'first_sale', 'invite_created', 'invite_shared', 'invite_accepted', 'app_installed', 'active_day', ...PANEL_STEPS.map(s => s[0])];
    for (const name of names) expect(describeEvent(event(name, '')).text).not.toBe('Actividad registrada');
    expect(describeEvent(event('stock_import_abandoned', '', { method: 'excel', at: 'review' }))).toMatchObject({ text: 'Cerró el Excel sin importar (en Revisar)', negative: true });
    expect(describeEvent(event('stock_method_chosen', '', { method: 'skip' })).negative).toBe(true);
    expect(describeEvent(event('stock_import_finished', '', { method: 'excel', rows: '11-50', ok: true })).text).toBe('Cargó entre 11 y 50 equipos por Excel');
    expect(describeEvent(event('first_step_completed', '', { step: 'sale', index: 3 })).text).toBe('Primeros pasos 3/5: primera venta');
    expect(describeEvent(event('invite_shared', '', { channel: 'whatsapp' })).text).toBe('Compartió la invitación por WhatsApp');
    expect(describeEvent(event('unknown_private_event', '', { secret: 'private' })).text).toBe('Actividad registrada');
  });
  it('uses milestone evidence without treating two members active on one day as retention', () => {
    const events = [event('active_day', '2026-10-18T13:00:00Z'), event('active_day', '2026-10-18T14:00:00Z'), event('first_step_completed', '', { step: 'sale', index: 3 })];
    expect(timelineMilestones(events).has('returned')).toBe(false);
    expect(timelineMilestones(events).has('first_sale')).toBe(true);
    expect(timelineMilestones([...events, event('active_day', '2026-10-17T13:00:00Z')]).has('returned')).toBe(true);
    expect(medianDuration(2 / 60)).toBe('2 min'); expect(medianDuration(24)).toBe('1 día'); expect(medianDuration(null)).toBe('—');
  });
});
