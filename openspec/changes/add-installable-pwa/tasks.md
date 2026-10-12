## Frontend and serving

- [x] 1. Complete manifest/Apple metadata and generate proposal 3 icons and launch images.
- [x] 2. Add production static-only service worker, registration and cache-safe serving headers.
- [x] 3. Add delayed Safari guide/Android install UI with persistent dismissal and installed detection.
- [x] 4. Respect standalone safe areas including authentication and landscape layouts.
- [x] 5. Implement iOS standalone Firebase redirect, result/error handling and same-origin helper proxy.

## Backend

No business API, AppContext or Prisma changes required.

## Validation and delivery

- [x] 6. Run unit tests, frontend/backend TypeScript checks and production build; attempt browser tests and record environment restrictions in docs/pwa.md.
- [x] 7. Document results, deployment prerequisites and the remaining real-device/OAuth check.
- [ ] 8. Complete real-browser/iPhone validation and Google OAuth on the deployed origin. Blocked here by browser/socket/DNS restrictions and no real device; checklist and isolated production E2E suite are included.
- [ ] 9. Commit locally on the current branch without push or PR. Blocked by read-only .git: git add cannot create .git/index.lock.
