import { test } from '@playwright/test';
import { onboardingCases } from './onboarding-cases';

// Exercise the same phone journey with the browser available in local QA.
// The existing onboarding-iphone suite retains its WebKit coverage in CI.
test.skip(process.env.DASHBOARD_HUNT_LOCAL !== '1', 'Use the local-only hunt config');
test.use({ viewport: { width: 390, height: 844 }, browserName: 'chromium', isMobile: true, hasTouch: true });
onboardingCases(true);
