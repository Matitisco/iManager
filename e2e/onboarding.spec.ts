import { test } from '@playwright/test';
import { onboardingCases } from './onboarding-cases';
test.use({ viewport: { width: 1440, height: 900 } });
onboardingCases(false);
