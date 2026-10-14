import { defineConfig, devices } from '@playwright/test';

const pwaPort = process.env.PLAYWRIGHT_PWA_PORT || '4192';
const pwaUrl = `http://127.0.0.1:${pwaPort}`;

// Production build and real SW; backend responses/auth identity are test fixtures.
// No database or live Firebase account is used by this isolated suite.
export default defineConfig({
  testDir: './e2e/pwa',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { baseURL: pwaUrl, serviceWorkers: 'allow', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'android-chromium', use: { ...devices['Pixel 5'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'NODE_ENV=production npx vite build --outDir .pwa-test-dist && node e2e/pwa/server.mjs',
    url: pwaUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: pwaUrl },
  },
});
