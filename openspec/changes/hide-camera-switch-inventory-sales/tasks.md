## Frontend

- [x] Add a default-enabled camera-switch option to the shared scanner and apply it to Inventory and Sales entry points only.
- [x] Preserve other scanner contexts and existing scan behavior.
- [x] Add unit and E2E regressions for multiple-camera Inventory/Sales flows and an unaffected flow.

## Backend

- [x] No backend, AppContext, or Prisma changes are required.

## Validation and handoff

- [x] Run focused scanner tests, E2E scan specs, and frontend/backend TypeScript checks; do not build.
- [x] Capture synthetic screenshots for Inventory and Sales scanners and attach them to the pull request.
- [x] Review the diff and leave the pull request open for Sol's review; do not merge or close #455.
- [ ] After Sol review, CI, merge, and confirmed deploy, verify the deployed UI in a browser at desktop and mobile sizes using read-only navigation; save evidence and close #455 manually only after the check passes. Report any unavailable authenticated session as a blocker.
