import { devices, test } from '@playwright/test';
import { registerCashOperationTests } from './cash-operations.flow';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType, ...iphone });
test.describe('caja opcional iPhone', () => registerCashOperationTests('iphone'));
