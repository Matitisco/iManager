import { test } from '@playwright/test';
import { importTextCases } from './import-text-cases';
test.use({ viewport: { width: 1440, height: 900 } });
importTextCases(false);
