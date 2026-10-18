import { devices, test } from '@playwright/test';
import { onboardingCases } from './onboarding-cases';
test.use({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, browserName: 'webkit' });
onboardingCases(true);
