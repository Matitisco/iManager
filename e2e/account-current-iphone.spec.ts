import { devices, test } from '@playwright/test';
import { registerAccountTests } from './account-current.flow';

const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType, ...iphone });

test.describe('cuenta corriente iphone', () => {
  registerAccountTests({ name: 'iphone' });
});