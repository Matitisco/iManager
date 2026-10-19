import { defineConfig } from '@playwright/test';

/** Capturas locales del repaso post-#395. No entra en la CI: el job `test` usa playwright.config.ts. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'post395-shots.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173',
    cwd: '.',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:5173',
      VITE_TEST_AUTH_MODE: 'e2e',
      VITE_E2E_TEST_PASSWORD: 'test123456',
      DISABLE_HMR: 'true',
    },
  },
});
