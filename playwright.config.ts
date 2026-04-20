import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const DEFAULT_FRONTEND_URL = process.env.PLAYWRIGHT_APP_BASE_URL?.trim() || 'http://127.0.0.1:4173';
const DEFAULT_BACKEND_URL = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const DEFAULT_DATABASE_URL = process.env.DATABASE_URL?.trim() || 'postgresql://postgres:postgres@127.0.0.1:5432/imanager_test';
const DEFAULT_E2E_PASSWORD = process.env.VITE_E2E_TEST_PASSWORD?.trim() || 'test123456';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(repoRoot, 'backend');

function resolveBin(bin: string) {
  return process.platform === 'win32' ? `${bin}.cmd` : bin;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: path.resolve(repoRoot, 'e2e/global-setup.ts'),
  use: {
    baseURL: DEFAULT_FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: `${resolveBin('npx')} tsx src/server.ts`,
      cwd: backendDir,
      url: `${DEFAULT_BACKEND_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: '3100',
        NODE_ENV: 'test',
        DATABASE_URL: DEFAULT_DATABASE_URL,
        ENABLE_TEST_AUTH_BYPASS: 'true',
        FRONTEND_URL: DEFAULT_FRONTEND_URL,
      },
    },
    {
      command: `${resolveBin('npx')} vite --host 127.0.0.1 --port 4173`,
      cwd: repoRoot,
      url: DEFAULT_FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: DEFAULT_BACKEND_URL,
        VITE_TEST_AUTH_MODE: 'e2e',
        VITE_E2E_TEST_PASSWORD: DEFAULT_E2E_PASSWORD,
        DISABLE_HMR: 'true',
      },
    },
  ],
});
