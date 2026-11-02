import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// Mocked API: layout regression coverage needs only the Vite dev server.
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'desktop-table-scroll.spec.ts',
  globalSetup: undefined,
  workers: 2,
  webServer: (base.webServer as Array<{ command: string }>).filter(server => server.command.includes('vite ')),
});
