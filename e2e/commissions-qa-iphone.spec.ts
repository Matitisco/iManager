import { test, devices } from '@playwright/test';
import { commissionsQaTests } from './commissions-qa-cases';
test.use({ ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 393, height: 852 } });
commissionsQaTests(true);
