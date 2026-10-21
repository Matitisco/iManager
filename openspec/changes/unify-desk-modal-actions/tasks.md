## Interaction core — Sol high

- [x] Add the minimal focus/layer/dismissal hook with explicit busy handling.
- [x] Integrate Sheet/Dialog without breaking existing footer extraction.
- [x] Register nested selector/state editor, preserve calendar Escape and wire expense busy.
- [x] Add regressions, including pending/failed synthetic expense persistence.
- [x] Run frontend/backend TypeScript and focused regressions, without build.
- [x] Document and commit the tested interaction core on the #447 branch.

## Visual migration — Luna max

- [x] Apply the shared persistent header, internally scrolling body and fixed footer layout.
- [x] Migrate commission rules/payments, expenses, sales, trade-ins, equipment, clients and repairs with state-specific action hierarchy.
- [x] Preserve current callbacks, authorization predicates, confirmation flows, drafts and financial calculations.
- [x] Update behavioral/geometry E2E and focused tests for menus, busy/error states, fixed footers and final-field reachability.
- [x] Capture and inspect synthetic screenshots at 1440x900, 1536x640, 390x844 and 320x844.
- [x] Run frontend/backend TypeScript and focused UI tests; no build.
- [x] Sol high local review: fix busy reason-sheet dismissal, disclosure focus, manual-sheet CSS compatibility, scanner layer ownership and clipped/obstructing footer menus; add regressions and rerun the full frontend suite.
- [x] Receive specific approval to publish #447 to Matitisco/iManager after the denied push; no alternate publication route.
- [ ] Green CI before merge; do not bypass.
- [ ] After deployment, perform authenticated browser QA and record the served version before closing #447.

No backend, AppContext, schema or dependency work is planned. No production or real-account data was used for local browser checks.
