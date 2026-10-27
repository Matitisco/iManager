## Frontend
- [x] Implement scoped filtered selection, shared action bar, confirmation and partial-failure handling.
- [x] Add selection and safe actions to the four screens and mobile long press/safe area.
- [x] Reuse CSV download with explicit selection export and tests.
- [x] Add frontend tests covering selection, permissions, failures and table wiring.

## Backend
- [x] Verify reused endpoints and add integration coverage for permissions, store scope, audit and operation rules; no new endpoints/schema.

## Validation
- [x] Run frontend/backend lint, frontend build/tests and backend unit/integration tests.
- [x] Generate and inspect desktop, iPhone and destructive confirmation screenshots.
- [x] Update project status and commit on current branch, without push.

## CI regression fix
- [x] Preserve unique data cell names with record-specific checkbox labels and a generic selection cell name.
- [x] Keep desktop row activation independent of bulk selection, including clicks outside the checkbox label in the selection cell.
- [x] Add regression coverage for all four tables while preserving mobile selection gestures.
- [x] Run lint, build, full frontend tests and full E2E suite; commit the fix without push.

## Continue after item failures (2026-10-27)
- [x] Continue sequential requests after item failures, track attempted progress and retain only failed selections.
- [x] Add Resultado with correct participles, expandable scrollable errors, Listo and client credit-balance recovery.
- [x] Replace stop-on-failure copy and add mixed/all-failed/30-row/progress/scope/unmount/duplicate-submit regressions and screen wiring coverage.
- [x] Run TypeScript/lint and 111 related unit tests only (maximum two workers); no app, database, screenshots, build or E2E execution.

Delivery: commit and push the current branch; open a PR for UI review without merging.
