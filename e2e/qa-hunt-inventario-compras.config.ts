import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

const app = process.env.PLAYWRIGHT_APP_BASE_URL || 'http://127.0.0.1:4257';
const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3257';
const database = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55537/qa_hunt_inventario_compras_e2e';
for (const value of [app, api, database]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) throw new Error('QA hunt requires exclusively local services');
}
if (new URL(database).pathname !== '/qa_hunt_inventario_compras_e2e') throw new Error('Use the dedicated QA hunt E2E database');
process.env.DATABASE_URL = database;
process.env.PLAYWRIGHT_API_BASE_URL = api;
process.env.PLAYWRIGHT_APP_BASE_URL = app;
const servers = Array.isArray(base.webServer) ? base.webServer : [];

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: ['qa-hunt-inventario-compras.spec.ts', 'inventory-quantity-imei.spec.ts', 'onboarding-import.spec.ts'],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  outputDir: 'test-results/qa-hunt-inventario-compras',
  reporter: [['list']],
  use: { ...base.use, baseURL: app, timezoneId: 'America/Argentina/Buenos_Aires', video: 'off', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] } },
  webServer: servers.map(server => ({
    ...server,
    url: server.cwd?.endsWith('/backend') ? `${api}/api/health` : app,
    command: server.cwd?.endsWith('/backend') ? 'npx tsx scripts/e2e-server.ts' : `npx vite --host 127.0.0.1 --port ${new URL(app).port} --strictPort`,
    env: { ...server.env, DATABASE_URL: database, PORT: new URL(api).port, FRONTEND_URL: app,
      VITE_API_BASE_URL: api, OPENAI_API_KEY: '', POSTHOG_PERSONAL_API_KEY: '', MERCADOPAGO_ACCESS_TOKEN: '', SMTP_HOST: '' },
  })),
});
