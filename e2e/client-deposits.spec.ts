import { devices, test } from '@playwright/test';
import { registerDepositTests } from './client-deposits.flow';

const { defaultBrowserType: _androidBrowser, ...android } = devices['Pixel 5'];

for (const device of [
  { name: 'desktop', mobile: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile-android', mobile: true, options: android },
]) {
  test.describe(`client deposits ${device.name}`, () => {
    test.use(device.options);
    registerDepositTests(device);
  });
}
