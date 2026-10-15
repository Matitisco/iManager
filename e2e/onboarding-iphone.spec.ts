import { devices, test } from '@playwright/test';
import { onboardingCases } from './onboarding-cases';
test.use({ ...devices['iPhone 13'], browserName: 'webkit' });
onboardingCases(true);
