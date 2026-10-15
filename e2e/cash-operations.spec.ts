import { test } from '@playwright/test';
import { registerCashOperationTests } from './cash-operations.flow';
test.use({ viewport: { width: 1440, height: 900 } });
test.describe('caja opcional desktop', () => registerCashOperationTests('desktop'));
