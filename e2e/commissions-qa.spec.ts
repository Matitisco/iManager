import { test } from '@playwright/test';
import { commissionsQaTests } from './commissions-qa-cases';
test.use({ viewport: { width: 1440, height: 900 } });
commissionsQaTests(false);
