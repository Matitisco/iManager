import { test } from '@playwright/test';
import { commissionTests } from './commissions-cases';
test.use({ viewport: { width: 1440, height: 900 } });
commissionTests('desktop');
