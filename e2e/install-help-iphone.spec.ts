import { test } from '@playwright/test';
import { installHelpTests } from './install-help-cases';
test.use({ browserName: 'webkit' });
installHelpTests(false, ['iphone']);
