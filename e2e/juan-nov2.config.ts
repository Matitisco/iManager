import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from '../playwright.config';

// This suite may only run against disposable loopback services.
const app = process.env.PLAYWRIGHT_APP_BASE_URL || 'http://127.0.0.1:4196';
const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3196';
const database = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55492/qa_juan_nov2';
for (const value of [app, api, database]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) {
    throw new Error('Juan QA requires local services, including PostgreSQL');
  }
}
if (!new URL(database).pathname.endsWith('/qa_juan_nov2')) throw new Error('Use the dedicated qa_juan_nov2 database');
process.env.DATABASE_URL = database;
process.env.PLAYWRIGHT_API_BASE_URL = api;
process.env.PLAYWRIGHT_APP_BASE_URL = app;
process.env.JUAN_QA_LOCAL = '1';
const artifacts = process.env.JUAN_QA_ARTIFACTS || path.resolve('test-results/juan-nov2');
process.env.JUAN_QA_ARTIFACTS = artifacts;
const servers = Array.isArray(base.webServer) ? base.webServer : base.webServer ? [base.webServer] : [];

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'juan-nov2.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: path.join(artifacts, 'results.json') }]],
  outputDir: path.join(artifacts, 'test-results'),
  use: { ...base.use, baseURL: app, timezoneId: 'America/Argentina/Buenos_Aires', trace: 'retain-on-failure', video: 'off' },
  webServer: process.env.JUAN_QA_EXISTING === '1' ? undefined : servers.map(server => ({
    ...server,
    url: server.cwd?.endsWith('/backend') ? `${api}/api/health` : app,
    command: server.cwd?.endsWith('/backend') ? 'npx tsx scripts/e2e-server.ts' : `npx vite --host 127.0.0.1 --port ${new URL(app).port} --strictPort`,
    env: { ...server.env, DATABASE_URL: database, PORT: new URL(api).port, FRONTEND_URL: app,
      VITE_API_BASE_URL: api, ADMIN_EMAILS: 'platform-admin@imanager.test', POSTHOG_PERSONAL_API_KEY: '',
      MERCADOPAGO_ACCESS_TOKEN: '', SMTP_HOST: '' },
  })),
});
