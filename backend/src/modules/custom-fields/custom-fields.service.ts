import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { parseArDate } from '../../lib/ar-date.js';
import { DomainError } from '../../lib/domain-error.js';

export const definitionSchema = z.object({
  entity: z.literal('inventory').default('inventory'),
  key: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/).refine(value => !['constructor', 'prototype', '__proto__'].includes(value)),
  label: z.string().trim().min(1).max(100),
  type: z.enum(['text', 'date', 'number']),
  order: z.number().int().min(0).max(10000).default(0),
});
export type DefinitionInput = z.infer<typeof definitionSchema>;
type Db = Prisma.TransactionClient;
export function listDefinitions(storeId: string, db: Db = prisma) {
  return db.customFieldDefinition.findMany({ where: { storeId, entity: 'inventory', archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }] });
}
export async function ensureDefinitions(storeId: string, definitions: DefinitionInput[], db: Db) {
  for (const raw of definitions) {
    const input = definitionSchema.parse(raw);
    const existing = await db.customFieldDefinition.findUnique({ where: { storeId_entity_key: { storeId, entity: input.entity, key: input.key } } });
    if (existing) {
      if (existing.archivedAt || existing.type !== input.type || existing.label !== input.label) throw new DomainError(`El campo «${input.label}» ya existe con otra definición`, 409);
    } else await db.customFieldDefinition.create({ data: { ...input, storeId } });
  }
}
export function fieldValue(value: unknown, definition: Pick<DefinitionInput, 'label' | 'type'>): string | number | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw new DomainError(`${definition.label}: valor inválido`, 400);
  const text = String(value).trim();
  if (!text) return null;
  if (definition.type === 'text') {
    if (text.length > 2000) throw new DomainError(`${definition.label}: máximo 2000 caracteres`, 400);
    return text;
  }
  if (definition.type === 'date') {
    const date = parseArDate(text);
    if (!date) throw new DomainError(`${definition.label}: fecha inválida (dd/mm/aaaa)`, 400);
    // Calendar dates stay independent of the server/browser timezone.
    return date.toISOString().slice(0, 10);
  }
  let number = text;
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(number)) number = number.replace(/\./g, '').replace(',', '.');
  else number = number.replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(number) || !Number.isFinite(Number(number))) throw new DomainError(`${definition.label}: número inválido`, 400);
  return Number(number);
}
export function convertFields(fields: Record<string, unknown>, definitions: Pick<DefinitionInput, 'key' | 'label' | 'type'>[]) {
  const result = { ...fields };
  for (const definition of definitions) if (Object.hasOwn(fields, definition.key)) result[definition.key] = fieldValue(fields[definition.key], definition);
  return result;
}
export async function validateFields(storeId: string, fields: Record<string, unknown> | null | undefined, db: Db = prisma) {
  if (!fields || !Object.keys(fields).length) return fields;
  return convertFields(fields, await listDefinitions(storeId, db));
}
export function entryDateValue(value: string | null | undefined) {
  if (!value) return null;
  const date = parseArDate(value);
  if (!date) throw new DomainError('Fecha de ingreso inválida (dd/mm/aaaa)', 400);
  return date;
}
