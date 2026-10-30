## Frontend
- [x] Update the replay configuration while preserving all other safeguards.
- [x] Audit payment/card/CVV/token inputs and protect existing payment details and revealable passwords.
- [x] Adapt both PostHog regression test files to the new policy and rendered DOM boundaries.

## Verification and delivery
- [x] Check for other code-managed PostHog privacy settings.
- [x] Run frontend/backend TypeScript lint and only the two PostHog test files with at most two workers.

Delivery: commit, push, open the PR against `test`, wait for green checks and squash merge into `test`.

Validation: frontend/backend TypeScript lint passed; both PostHog test files passed (30 tests, maximum two workers). The SDK recorder verifies actual serialized content.
