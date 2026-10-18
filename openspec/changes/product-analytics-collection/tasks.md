# Tasks

- [x] Add additive schema and idempotent migration
- [x] Implement collection and server events
- [x] Implement aggregated admin JSON
- [x] Wire invisible frontend instrumentation and privacy sentence
- [x] Run unit, integration, frontend, TypeScript, build and feasible e2e checks

Validation: 923 frontend, 457 backend unit and 282 backend integration tests pass. Root/backend lint, explicit TypeScript and builds pass. Chromium: 12 desktop onboarding + 3 dashboard + 12 phone onboarding + 2 analytics sequence scenarios pass. WebKit could not launch because system libraries are missing; phone regression was run with a temporary Chromium wrapper, then removed. The idempotent migration ran twice against the local database, and Prisma reports no schema difference. No commits, pushes, production database writes or visual layout changes.
