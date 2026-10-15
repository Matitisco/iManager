import { devices, test } from '@playwright/test';
import { registerCashTests } from './cash-registers.flow';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType, ...iphone });
test.describe('caja diaria iPhone', () => registerCashTests('iphone'));
