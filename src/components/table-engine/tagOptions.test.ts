import { describe, expect, it } from 'vitest';
import { mergeDropdownOptions, readTagOptions, readTagOverrides, resolveTag, tagOptionsStorageKey } from './tagOptions';

describe('tag options', () => {
  it('keeps the stored option and applies a renamed label and color', () => {
    const resolved = resolveTag(
      'DISPONIBLE',
      { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DISPONIBLE' },
      { label: 'En local', colorId: 'blue' },
    );

    expect(resolved.label).toBe('En local');
    expect(resolved.bg).toBe('bg-blue-50');
    expect(resolved.text).toBe('text-blue-700');
    expect(resolved.colorId).toBe('blue');
  });

  it('ignores malformed stored overrides', () => {
    localStorage.setItem(tagOptionsStorageKey('inventory:user-1'), JSON.stringify({
      status: {
        DISPONIBLE: { label: '  En local  ', colorId: 'nope' },
        VENDIDO: { label: '' },
      },
      broken: 'x',
    }));

    expect(readTagOverrides('inventory:user-1')).toEqual({
      status: {
        DISPONIBLE: { label: 'En local' },
      },
    });
  });

  it('keeps created tags in the versioned store and ignores invalid ones', () => {
    localStorage.setItem(tagOptionsStorageKey('inventory:user-1'), JSON.stringify({
      v: 2,
      overrides: {
        status: { RESERVADO: { label: 'Reservado', colorId: 'amber' } },
      },
      created: {
        status: [' Reservado ', 'reservado', '', 'Apartado'],
        broken: 'nope',
      },
    }));

    expect(readTagOptions('inventory:user-1')).toEqual({
      overrides: {
        status: { RESERVADO: { label: 'Reservado', colorId: 'amber' } },
      },
      created: {
        status: ['Reservado', 'Apartado'],
      },
    });
  });

  it('appends created options without duplicating the current value', () => {
    expect(mergeDropdownOptions(['DISPONIBLE', 'VENDIDO'], ['Reservado', 'vendido'], 'Reservado')).toEqual([
      'DISPONIBLE',
      'VENDIDO',
      'Reservado',
    ]);
  });
});
