import { test } from '@playwright/test';
import { registerCashTests } from './cash-registers.flow';
test.use({ viewport: { width: 1440, height: 900 } });
test.describe('caja diaria desktop', () => registerCashTests('desktop'));
