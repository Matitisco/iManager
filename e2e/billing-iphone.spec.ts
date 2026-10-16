import { devices, test } from '@playwright/test';
import { registerBillingTests } from './billing.flow';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType, ...iphone });
test.describe('suscripciones iPhone', () => registerBillingTests('iphone'));
