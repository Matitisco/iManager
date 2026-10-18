# Tasks

- [x] Implement guarded routing and services
- [x] Implement funnel, stores and timeline to approved references
- [x] Add seven-day backend cohort and tests
- [x] Run frontend/backend tests, TypeScript and build
- [x] Capture and inspect all seven screenshots with a reproducible script

Validation and visual comparison notes: `docs/pr-shots/394-review.md`. All 936 frontend, 457 backend unit and 283 integration cases pass; final integration coverage was run in two profiles after intermittent database-reset timeouts. Three Chromium scenarios generate all seven required captures and verify history navigation and denied capabilities on every route. Root/backend lint, explicit TypeScript and the root build pass. No schema changes, commits, pushes or production database writes.
