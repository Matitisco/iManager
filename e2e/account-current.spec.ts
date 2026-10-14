import { test } from '@playwright/test';
import { registerAccountTests } from './account-current.flow';

test.describe('cuenta corriente desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  registerAccountTests({ name: 'desktop' });
});
