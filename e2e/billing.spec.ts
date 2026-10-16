import { test } from '@playwright/test';
import { registerBillingTests } from './billing.flow';
test.use({ viewport: { width: 1440, height: 1000 } });
test.describe('suscripciones desktop', () => registerBillingTests('desktop'));
