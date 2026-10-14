import { devices, test } from '@playwright/test';
import { commissionTests } from './commissions-cases';
test.use({ ...devices['Pixel 5'], browserName: 'chromium' });
commissionTests('Pixel 5');
