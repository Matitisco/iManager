import { devices, test } from '@playwright/test';
import { registerScanQa } from './qa-scan-1910';

const { defaultBrowserType: _browser, ...android } = devices['Pixel 7'];

test.use({
  ...android,
  browserName: 'chromium',
  viewport: { width: 390, height: 844 },
});

registerScanQa(390);
