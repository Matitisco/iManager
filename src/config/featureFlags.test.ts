import { expect, it } from 'vitest';
import { IMPORT_SALES_ENABLED } from './featureFlags';

it('disables sales import by default', () => {
  expect(IMPORT_SALES_ENABLED).toBe(false);
});
