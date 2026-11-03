import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { retentionConfig } from './config.js';
import { runLogRetention } from './service.js';

describe('configuración de retención', () => {
  it('requiere opt-in y simula por defecto incluso en producción o sin NODE_ENV', () => {
    for (const NODE_ENV of [undefined, 'production', 'development', 'test']) {
      expect(retentionConfig({ NODE_ENV })).toMatchObject({ enabled: false, dryRun: true,
        securityDays: 730, telemetryDays: 90, notificationDays: 90, batchSize: 100, maxBatches: 5 });
    }
    expect(retentionConfig({ RETENTION_JOBS_ENABLED: 'true' }).dryRun).toBe(true);
  });

  it.each([
    ['RETENTION_SECURITY_DAYS', '729'], ['RETENTION_TELEMETRY_DAYS', '89'],
    ['RETENTION_NOTIFICATION_DAYS', '0'], ['RETENTION_BATCH_SIZE', '501'],
    ['RETENTION_BATCH_SIZE', '1.5'], ['RETENTION_MAX_BATCHES', '21'],
    ['RETENTION_MAX_BATCHES', '0'], ['RETENTION_DRY_RUN', 'FALSE'],
    ['RETENTION_JOBS_ENABLED', 'yes'], ['RETENTION_SECURITY_DAYS', 'Infinity'],
  ])('rechaza %s=%s sin reducir los mínimos ni ampliar el presupuesto', (key, value) => {
    expect(() => retentionConfig({ [key]: value })).toThrow('Configuración de retención inválida');
  });

  it('permite ampliar plazos y configurar límites pequeños', () => {
    expect(retentionConfig({ RETENTION_SECURITY_DAYS: '1095', RETENTION_TELEMETRY_DAYS: '180',
      RETENTION_NOTIFICATION_DAYS: '365', RETENTION_BATCH_SIZE: '2', RETENTION_MAX_BATCHES: '1',
      RETENTION_JOBS_ENABLED: 'true', RETENTION_DRY_RUN: 'false' })).toMatchObject({
      securityDays: 1095, telemetryDays: 180, notificationDays: 365, batchSize: 2,
      maxBatches: 1, enabled: true, dryRun: false,
    });
  });

  it('no intenta conectar si está deshabilitado o en test', async () => {
    const log = { info() {} };
    expect((await runLogRetention({ environment: { DATABASE_URL: 'invalid' }, log })).status).toBe('disabled');
    expect((await runLogRetention({ environment: { NODE_ENV: 'test', DATABASE_URL: 'invalid', RETENTION_JOBS_ENABLED: 'true' }, log })).status).toBe('test');
  });

  it('la CLI omite test sin conectar y falla sin imprimir los valores inválidos', () => {
    const run = (env: Record<string, string>) => execFileSync(process.execPath,
      ['--import', 'tsx', 'scripts/retention-logs.ts'], { cwd: process.cwd(),
        env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', stdio: 'pipe' });
    expect(run({ NODE_ENV: 'test', RETENTION_JOBS_ENABLED: 'true', DATABASE_URL: 'invalid' })).toContain('"status":"test"');
    try {
      run({ RETENTION_BATCH_SIZE: 'private-fixture@example.invalid' });
      expect.fail('La configuración inválida debe fallar');
    } catch (error) {
      const output = error as { status: number; stderr: string; stdout: string };
      expect(output.status).toBe(1);
      expect(String(output.stderr)).toContain('ejecución fallida');
      expect(String(output.stderr) + String(output.stdout)).not.toContain('private-fixture');
    }
  }, 30_000);
});
