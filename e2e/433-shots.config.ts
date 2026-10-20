import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4331';
export default defineConfig({
  testDir: '.',
  testMatch: '433-shots.spec.ts',
  workers: 1,
  timeout: 90_000,
  outputDir: '/tmp/433-shot-results',
  use: {
    baseURL,
    browserName: 'chromium',
    timezoneId: 'America/Argentina/Buenos_Aires',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4331',
    url: baseURL,
    reuseExistingServer: false,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:3199', DISABLE_HMR: 'true' },
  },
});
