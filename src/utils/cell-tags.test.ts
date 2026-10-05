import { describe, expect, it } from 'vitest';
import { customFieldsFromRowForm, parseCellTags, withCustomField } from './cell-tags';

describe('parseCellTags', () => {
  it('splits, trims and drops duplicate tags', () => {
    expect(parseCellTags(' VIP , mayorista, , VIP,Urgente ')).toEqual(['VIP', 'mayorista', 'Urgente']);
    expect(parseCellTags(['Nuevo', ' nuevo ', '', 'Usado'])).toEqual(['Nuevo', 'Usado']);
  });
});

describe('custom field storage', () => {
  const columns = [
    { id: 'notes', type: 'text' },
    { id: 'score', type: 'number' },
    { id: 'labels', type: 'tags' },
  ];

  it('stores several tags from a comma-separated draft', () => {
    expect(customFieldsFromRowForm({
      'dynamic:notes': 'Detalle',
      'dynamic:score': '42',
      'dynamic:labels': 'VIP, Mayorista',
    }, columns)).toEqual({
      notes: 'Detalle',
      score: 42,
      labels: ['VIP', 'Mayorista'],
    });
  });

  it('normalizes a tags cell update into a list', () => {
    expect(withCustomField({ id: '1', customFields: { notes: 'A' } }, columns, 'labels', ['VIP', ' vip ', 'Urgente'])).toEqual({
      id: '1',
      customFields: {
        notes: 'A',
        labels: ['VIP', 'Urgente'],
      },
    });
  });
});
