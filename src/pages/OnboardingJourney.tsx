import { StockOnboarding } from "./StockOnboarding";

// Legacy invite/video stages resume at Stock. App guards keep completed stores out.
export function OnboardingJourney() {
  return <StockOnboarding onFinish={() => undefined} />;
}
