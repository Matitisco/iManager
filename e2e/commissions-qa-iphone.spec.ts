import { test, devices } from '@playwright/test';
import { commissionsQaTests } from './commissions-qa-cases';
test.use({ ...devices['iPhone 13'], browserName: 'webkit', serviceWorkers: 'block', viewport: { width: 393, height: 852 } });
commissionsQaTests(true);
