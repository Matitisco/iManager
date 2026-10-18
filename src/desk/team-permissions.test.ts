import { describe, expect, it } from 'vitest';
import type { TeamMember } from '../services/members-api';
import { DESK_SECTION_IDS } from './sections';
import { memberSectionSummary, PERMISSION_PROFILES, permissionProfile } from './team-permissions';

const member = (sections: string[] | null, role: TeamMember['role'] = 'STAFF') => ({ sections, role } as TeamMember);
describe('catalog team permissions', () => {
  it('includes catalog only in Todo and requires it when matching the profile', () => {
    expect(PERMISSION_PROFILES.Todo).toContain('publicCatalog');
    expect(PERMISSION_PROFILES.Vendedor).not.toContain('publicCatalog');
    expect(PERMISSION_PROFILES.Técnico).not.toContain('publicCatalog');
    for (const [name, sections] of Object.entries(PERMISSION_PROFILES)) expect(permissionProfile(sections)).toBe(name);
    expect(permissionProfile(PERMISSION_PROFILES.Todo.filter(id => id !== 'publicCatalog'))).toBe('Personalizado');
  });
  it('counts catalog for all-section summaries and labels explicit access', () => {
    expect(memberSectionSummary(member(DESK_SECTION_IDS))).toBe('Todas las secciones');
    expect(memberSectionSummary(member(DESK_SECTION_IDS.filter(id => id !== 'commissions')))).toBe('Todo menos Comisiones');
    expect(memberSectionSummary(member(DESK_SECTION_IDS.filter(id => id !== 'publicCatalog')))).not.toBe('Todas las secciones');
    expect(memberSectionSummary(member(['publicCatalog']))).toBe('Catálogo');
    expect(memberSectionSummary(member(null, 'MANAGER'))).not.toBe('Todas las secciones');
    expect(memberSectionSummary(member([], 'OWNER'))).toBe('Todas las secciones');
  });
});
