import { isSectionHidden } from '../config/hiddenSections';
import type { TeamMember } from '../services/members-api';
import { DESK_SECTIONS, grantedSections } from './sections';

export const PERMISSION_PROFILES = {
  Vendedor: ['dashboard', 'inventory', 'sales', 'tradeins', 'clients', 'cash', 'notifications'],
  Técnico: ['dashboard', 'service', 'clients', 'notifications'],
  Todo: [...DESK_SECTIONS.map(s => s.id), 'cashBalances'],
} satisfies Record<string, string[]>;

export function permissionProfile(sections: string[]) {
  return Object.entries(PERMISSION_PROFILES).find(([, values]) => values.length === sections.length && values.every(id => sections.includes(id)))?.[0] ?? 'Personalizado';
}

export function canEditMember(actorRole: string | undefined, actorUserId: string | undefined, member: TeamMember) {
  if (member.role === 'OWNER') return false;
  return actorRole === 'OWNER' || (actorRole === 'MANAGER' && member.role === 'STAFF' && member.userId !== actorUserId);
}

export function memberSectionSummary(member: TeamMember) {
  if (member.role === 'OWNER') return 'Todas las secciones';
  const sections = grantedSections(member.sections, member.role).filter(id => !isSectionHidden(id));
  const all = DESK_SECTIONS.filter(section => !isSectionHidden(section.id));
  if (sections.length === all.length) return 'Todas las secciones';
  if (sections.length === all.length - 1 && !sections.includes('commissions')) return 'Todo menos Comisiones';
  const labels = all.filter(s => sections.includes(s.id)).map(s => s.label);
  return labels.length ? labels.slice(0, 3).join(', ') + (labels.length > 3 ? ` +${labels.length - 3}` : '') : 'Sin secciones';
}
