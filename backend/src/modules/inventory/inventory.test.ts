import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ── Inline the schemas so tests don't depend on the server booting ──────────

const inventoryItemSchema = z.object({
  imei: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  capacity: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(50),
  condition: z.enum(['NUEVO', 'USADO', 'PRE-OWNED']),
  grade: z.enum(['A+', 'A', 'B', 'C', 'N/A']),
  batteryHealth: z.string().trim().max(50),
  cost: z.number().nonnegative(),
  price: z.number().nonnegative(),
  status: z.enum(['DISPONIBLE', 'VENDIDO', 'EN_REVISION']),
  categoryId: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

const inventoryPatchSchema = inventoryItemSchema.partial();

// ── batteryHealth schema ─────────────────────────────────────────────────────

describe('inventoryItemSchema — batteryHealth', () => {
  const base = {
    imei: '123456789012345',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Negro',
    condition: 'USADO' as const,
    grade: 'A' as const,
    cost: 500,
    price: 800,
    status: 'DISPONIBLE' as const,
  };

  it('accepts a plain numeric string ("87")', () => {
    const result = inventoryItemSchema.safeParse({ ...base, batteryHealth: '87' });
    expect(result.success).toBe(true);
  });

  it('accepts a percentage string ("87%")', () => {
    const result = inventoryItemSchema.safeParse({ ...base, batteryHealth: '87%' });
    expect(result.success).toBe(true);
  });

  it('accepts a range string ("83-85%")', () => {
    const result = inventoryItemSchema.safeParse({ ...base, batteryHealth: '83-85%' });
    expect(result.success).toBe(true);
  });

  it('accepts "100"', () => {
    const result = inventoryItemSchema.safeParse({ ...base, batteryHealth: '100' });
    expect(result.success).toBe(true);
  });

  it('rejects a number (must be string)', () => {
    const result = inventoryItemSchema.safeParse({ ...base, batteryHealth: 87 });
    expect(result.success).toBe(false);
  });

  it('rejects a value longer than 50 chars', () => {
    const result = inventoryItemSchema.safeParse({ ...base, batteryHealth: 'x'.repeat(51) });
    expect(result.success).toBe(false);
  });
});

// ── PATCH schema (partial) ───────────────────────────────────────────────────

describe('inventoryPatchSchema', () => {
  it('allows patching only batteryHealth as string', () => {
    const result = inventoryPatchSchema.safeParse({ batteryHealth: '92%' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.batteryHealth).toBe('92%');
  });

  it('allows patching only price', () => {
    const result = inventoryPatchSchema.safeParse({ price: 999 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price).toBe(999);
  });

  it('allows patching only model', () => {
    const result = inventoryPatchSchema.safeParse({ model: 'iPhone 14 Pro' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.model).toBe('iPhone 14 Pro');
  });

  it('rejects negative price', () => {
    const result = inventoryPatchSchema.safeParse({ price: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown condition value', () => {
    const result = inventoryPatchSchema.safeParse({ condition: 'ROTO' });
    expect(result.success).toBe(false);
  });
});

// ── normalizeBattery (imported inline to avoid DB deps) ──────────────────────

function normalizeBattery(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '100';
  const s = String(raw).trim();
  if (s.includes('-') || s.includes('%')) return s;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0 && n <= 1) return String(Math.round(n * 100));
  return s;
}

describe('normalizeBattery', () => {
  it('returns "100" for empty/null/undefined', () => {
    expect(normalizeBattery('')).toBe('100');
    expect(normalizeBattery(null)).toBe('100');
    expect(normalizeBattery(undefined)).toBe('100');
  });

  it('passes through range strings unchanged', () => {
    expect(normalizeBattery('83-85%')).toBe('83-85%');
    expect(normalizeBattery('80-90')).toBe('80-90');
  });

  it('passes through percentage strings unchanged', () => {
    expect(normalizeBattery('87%')).toBe('87%');
    expect(normalizeBattery('100%')).toBe('100%');
  });

  it('converts decimal fraction to percentage string', () => {
    expect(normalizeBattery(0.87)).toBe('87');
    expect(normalizeBattery('0.84')).toBe('84');
    expect(normalizeBattery(1)).toBe('100');
  });

  it('passes through plain numeric strings', () => {
    expect(normalizeBattery('87')).toBe('87');
    expect(normalizeBattery('100')).toBe('100');
  });
});
