import { devices, test } from '@playwright/test';
import { editSaleSellerTests } from './edit-sale-seller.flow';
test.use({ ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } });
editSaleSellerTests(true);
