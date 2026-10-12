import { defineConfig, devices } from '@playwright/test';

// Production build and real SW; backend responses/auth identity are test fixtures.
// No database or live Firebase account is used by this isolated suite.
export default defineConfig({
  testDir: './e2e/pwa',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4192', serviceWorkers: 'allow', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'android-chromium', use: { ...devices['Pixel 5'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'NODE_ENV=production npx vite build --outDir .pwa-test-dist && node e2e/pwa/server.mjs',
    url: 'http://127.0.0.1:4192',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:4192' },
  },
});
