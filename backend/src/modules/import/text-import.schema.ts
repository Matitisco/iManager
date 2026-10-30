import { z } from 'zod';

export const TEXT_LIMITS = { bytes: 100_000, lines: 1000, lineChars: 4000, rows: 2000, chunkLines: 40, chunkChars: 8000, concurrency: 3, callMs: 30_000, totalMs: 180_000 } as const;
export const textRowSchema = z.object({
  line: z.number().int().min(1),
  endLine: z.number().int().min(1),
  model: z.string().min(1).max(120),
  capacity: z.string().max(30).nullable(),
  color: z.string().max(50).nullable(),
  batteryHealth: z.string().max(30).nullable(),
  condition: z.enum(['NUEVO', 'USADO', 'PRE-OWNED', 'OUTLET']).nullable(),
  imei: z.string().max(100).nullable(),
  serial: z.string().max(100).nullable(),
  price: z.number().finite().nonnegative().nullable(),
  currency: z.enum(['ARS', 'USD']).nullable(),
  cost: z.number().finite().nonnegative().nullable(),
  quantity: z.number().int().safe().min(1),
  dudas: z.array(z.string().max(250)).max(15),
}).strict();
export const textOutputSchema = z.object({
  rows: z.array(textRowSchema).max(TEXT_LIMITS.rows),
  discarded: z.array(z.object({ line: z.number().int().min(1), reason: z.string().min(1).max(250) }).strict()).max(TEXT_LIMITS.lines),
}).strict();
export type TextRow = z.infer<typeof textRowSchema>;

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'], minimum: 0 };
export const TEXT_OUTPUT_JSON_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['rows', 'discarded'],
  properties: {
    rows: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: Object.keys(textRowSchema.shape),
      properties: {
        line: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 },
        model: { type: 'string' }, capacity: nullableString, color: nullableString, batteryHealth: nullableString,
        condition: { type: ['string', 'null'], enum: ['NUEVO', 'USADO', 'PRE-OWNED', 'OUTLET', null] },
        imei: nullableString, serial: nullableString, price: nullableNumber,
        currency: { type: ['string', 'null'], enum: ['ARS', 'USD', null] }, cost: nullableNumber,
        quantity: { type: 'integer', minimum: 1 },
        dudas: { type: 'array', items: { type: 'string' } },
      },
    } },
    discarded: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['line', 'reason'],
      properties: { line: { type: 'integer', minimum: 1 }, reason: { type: 'string' } },
    } },
  },
};
