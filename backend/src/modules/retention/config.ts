import { z } from 'zod';

const flag = (fallback: boolean) => z.enum(['true', 'false']).optional().transform(value => value === undefined ? fallback : value === 'true');
const days = (minimum: number) => z.coerce.number().int().min(minimum).max(36_500).default(minimum);

const schema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('production'),
  RETENTION_JOBS_ENABLED: flag(false),
  RETENTION_DRY_RUN: flag(true),
  RETENTION_SECURITY_DAYS: days(730),
  RETENTION_TELEMETRY_DAYS: days(90),
  RETENTION_NOTIFICATION_DAYS: days(90),
  RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  RETENTION_MAX_BATCHES: z.coerce.number().int().min(1).max(20).default(5),
});

export function retentionConfig(source: Record<string, string | undefined> = process.env) {
  const parsed = schema.safeParse(source);
  // Never forward Zod input values or arbitrary environment contents to the logger.
  if (!parsed.success) throw new Error('Configuración de retención inválida. Revisá las variables RETENTION_* y NODE_ENV.');
  const value = parsed.data;
  return {
    enabled: value.RETENTION_JOBS_ENABLED,
    testEnvironment: value.NODE_ENV === 'test',
    dryRun: value.RETENTION_DRY_RUN,
    securityDays: value.RETENTION_SECURITY_DAYS,
    telemetryDays: value.RETENTION_TELEMETRY_DAYS,
    notificationDays: value.RETENTION_NOTIFICATION_DAYS,
    batchSize: value.RETENTION_BATCH_SIZE,
    maxBatches: value.RETENTION_MAX_BATCHES,
  };
}

export type RetentionConfig = ReturnType<typeof retentionConfig>;
