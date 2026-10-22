import { defineConfig } from '@playwright/test';

// Vite only: no backend process, global database setup, build or service worker.
export default defineConfig({
  testDir: '.',
  testMatch: 'install-466.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../test-results/install-466',
  use: { baseURL: 'http://127.0.0.1:4466', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4466 --strictPort',
    cwd: '..',
    url: 'http://127.0.0.1:4466',
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:3466', VITE_TEST_AUTH_MODE: 'e2e', VITE_E2E_TEST_PASSWORD: 'test123456', DISABLE_HMR: 'true' },
  },
});
