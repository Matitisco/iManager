import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

const app = process.env.PLAYWRIGHT_APP_BASE_URL || 'http://127.0.0.1:4186';
const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3186';
const database = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55461/qa_hunt_dashboard_e2e';
for (const value of [app, api, database]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) {
    throw new Error('QA hunt requires loopback services, including PostgreSQL');
  }
}
if (new URL(database).pathname !== '/qa_hunt_dashboard_e2e') throw new Error('Use the dedicated qa_hunt_dashboard_e2e database');
process.env.DATABASE_URL = database;
process.env.PLAYWRIGHT_API_BASE_URL = api;
process.env.PLAYWRIGHT_APP_BASE_URL = app;
process.env.DASHBOARD_HUNT_LOCAL = '1';
const servers = Array.isArray(base.webServer) ? base.webServer : [];

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: ['hunt-dashboard-permisos-onboarding.spec.ts', 'hunt-onboarding-mobile.spec.ts', 'onboarding.spec.ts', 'onboarding-import.spec.ts', 'team-permissions.spec.ts', 'staff-reports-permission.spec.ts', 'mobile-dashboard.spec.ts'],
  workers: 1,
  retries: 0,
  use: { ...base.use, baseURL: app, timezoneId: 'America/Argentina/Buenos_Aires', video: 'off', trace: 'retain-on-failure' },
  webServer: servers.map(server => ({
    ...server,
    url: server.cwd?.endsWith('/backend') ? `${api}/api/health` : app,
    command: server.cwd?.endsWith('/backend') ? 'npx tsx scripts/e2e-server.ts' : `npx vite --host 127.0.0.1 --port ${new URL(app).port} --strictPort`,
    env: { ...server.env, DATABASE_URL: database, PORT: new URL(api).port, FRONTEND_URL: app,
      VITE_API_BASE_URL: api, POSTHOG_PERSONAL_API_KEY: '', POSTHOG_API_KEY: '',
      VITE_POSTHOG_KEY: '', MERCADOPAGO_ACCESS_TOKEN: '', SMTP_HOST: '', RESEND_API_KEY: '' },
  })),
});
