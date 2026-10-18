# Tasks

- [x] Capture desktop/iPhone before cards for ARS 750000 and USD 8000000 before editing code.
- [x] Implement shared donut-only fitting and accessible exact totals; inspect other centered rings.
- [x] Add pure unit regressions and desktop/iPhone E2E coverage across report tabs/dimensions.
- [x] Capture matching after cards and pass lint, typecheck, Vitest, build and relevant E2E.

## Validation

- Frontend lint and `npx tsc --noEmit`: passed; backend lint: passed.
- `npx vitest run --maxWorkers=2 --pool=threads --reporter=verbose`: 125 files, 862 tests passed (including 28 donut helper tests). Runs with the default reporter stalled in this environment and were stopped; threads with the verbose reporter completed successfully.
- `npm run build`: passed (existing bundle-size warning).
- Mock-only `report-donut-fit.spec.ts`: 4 passed, Chromium 1280×800 and WebKit iPhone 393×852, ARS/USD, all tabs and built-in breakdowns, selected percentages, actual glyph range and unclipped text.
- Existing `mobile-reports`, `report-dropdown`, `report-dropdown-iphone`: 6 passed using an isolated temporary PostgreSQL instance on loopback port 55491 with synthetic data only.
- Eight before/after ARS/USD screenshots saved in `docs/pr-shots/torta-*.png`; before shots captured before code changes. After screenshots reviewed.
- Other centered rings: Dashboard's bounded task count and First steps' bounded completion count fit their existing rings. No additional monetary donuts were found.
- No commits, pushes, branches, PRs, production database access, or changes to the shared money formatter.

## Reproduce without a database

```bash
PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4391 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3391 \
TORTA_SHOTS=docs/pr-shots \
npx playwright test --config e2e/playwright.donut.config.ts --workers=1
```

The standalone config skips backend startup and Prisma setup. Browser binaries/system libraries must be available. This environment needed locally extracted WebKit libraries and an EGL vendor path, all under ignored `node_modules/.cache`; no system installation or other worktree was modified.
