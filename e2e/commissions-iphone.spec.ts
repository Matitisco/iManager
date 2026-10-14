import { devices, test } from '@playwright/test';
import { commissionTests } from './commissions-cases';
test.use({ ...devices['iPhone 13'], browserName: 'webkit' });
commissionTests('iPhone 13');
