import { devices, test } from '@playwright/test';
import { registerDepositTests } from './client-deposits.flow';

const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType, ...iphone });

test.describe('client deposits mobile-iphone', () => {
  registerDepositTests({ name: 'mobile-iphone', mobile: true });
});
