import { test } from '@playwright/test';
import { editSaleSellerTests } from './edit-sale-seller.flow';
test.use({ browserName: 'chromium', viewport: { width: 1440, height: 900 } });
editSaleSellerTests(false);
