import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSource = readFileSync(join(__dirname, './Onboarding.tsx'), 'utf-8');
const loginSource = readFileSync(join(__dirname, './Login.tsx'), 'utf-8');
const appSource = readFileSync(join(__dirname, '../App.tsx'), 'utf-8');

describe('invitation preview flow surfaces technical errors without marking links invalid', () => {
  it('shares the invitation preview hook across login, onboarding and app shell', () => {
    expect(loginSource).toContain("useInvitationPreview(inviteToken)");
    expect(onboardingSource).toContain("useInvitationPreview(inviteToken)");
    expect(appSource).toContain('useInvitationPreview(');
  });

  it('keeps onboarding on a recoverable technical error branch instead of invalidating the invite', () => {
    expect(onboardingSource).toContain("if (inviteToken && inviteState.error)");
    expect(onboardingSource).toContain('Reintentar verificación');
    expect(onboardingSource).toContain("if (inviteToken && inviteState.invalid)");
  });
});
