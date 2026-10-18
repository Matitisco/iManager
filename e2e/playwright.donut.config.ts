import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// Fully mocked API: this visual regression needs neither Prisma nor a database.
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'report-donut-fit.spec.ts',
  globalSetup: undefined,
  webServer: (base.webServer as Array<{ command: string }>).filter(server => server.command.includes('vite ')),
});
