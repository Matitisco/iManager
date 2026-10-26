- [x] Update replay configuration and regression test
- [x] Annotate sensitive values across lists, details, receipts, catalog, team and import previews
- [x] Run TypeScript/lint, related tests and build

Validation: frontend and backend TypeScript/lint pass. Related tests run with at most two workers; final regression pass: 261 tests across 15 files, with additional affected-screen and shared-component tests passing in targeted runs. Production frontend build passes. Chromium checks at 390/1440 px preserve geometry (within subpixel rounding) and typography for badges, detail amounts, client names and receipts. No screenshots or production data required.

Delivery: review-only PR; monitor CI using gh pr checks --watch and do not merge.
