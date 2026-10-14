import { test, devices } from '@playwright/test';
import { importTextCases } from './import-text-cases';
test.use({ ...devices['iPhone 13'], browserName: 'webkit' });
importTextCases(true);
