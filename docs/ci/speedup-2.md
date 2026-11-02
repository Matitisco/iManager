# CI speedup measurements

## Scope and method

Baseline collected **before editing**: last 30 CI runs, 318 jobs, October 30–November 2, 2026 UTC (20 PR, 8 main push, 2 scheduled). 14 successful workflows, 12 failed and 4 cancelled. All jobs use free GitHub-hosted `ubuntu-latest` runners; browser images remain lockfile-matched Playwright.

Reproduce with `node scripts/ci-timings.mjs collect /tmp/ci.json` and `node scripts/ci-timings.mjs report /tmp/ci.json`. Pass explicit run IDs after the output path to compare the same cohort. Measurements use GitHub job/step timestamps (one-second resolution), **medians of successful jobs only**. Failed/cancelled/skipped jobs remain in denominators, never count as a speedup. Queue is job `created_at → started_at` (excludes dependency wait before job creation); setup is job duration minus execution and cleanup. Execution includes lint/typecheck/build/test/selection steps; cleanup includes post-actions/container stop. Unattributed gaps stay in setup. Full versus related-test cohorts must be compared separately.

## Baseline: all 30 runs

| Job                    | OK / total | Queue |  Setup | Execution | Cleanup | Job total |
| ---------------------- | ---------: | ----: | -----: | --------: | ------: | --------: |
| changes                |      30/30 | 2.0 s |  7.0 s |     0.0 s |   0.0 s |     8.0 s |
| lint                   |      29/30 | 2.0 s | 22.0 s |    31.0 s |   0.0 s |    54.0 s |
| backend-tests          |      18/30 | 2.0 s | 31.0 s |   298.5 s |   1.0 s |   334.0 s |
| pwa (iphone-webkit)    |       0/10 |     — |      — |         — |       — |         — |
| pwa (desktop-chromium) |      10/10 | 2.0 s | 45.5 s |    47.5 s |   1.0 s |    95.0 s |
| frontend-unit (2)      |      15/18 | 2.0 s | 53.0 s |   141.0 s |   1.0 s |   191.0 s |
| e2e (1)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (3)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (6)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (2)                |       0/10 |     — |      — |         — |       — |         — |
| pwa (android-chromium) |      14/24 | 2.0 s | 44.0 s |    18.0 s |   2.0 s |    63.0 s |
| frontend-unit (1)      |      24/30 | 2.0 s | 49.5 s |   121.0 s |   1.0 s |   174.5 s |
| e2e (5)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (8)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (7)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (4)                |       0/10 |     — |      — |         — |       — |         — |
| test                   |      14/30 | 2.0 s |  3.0 s |     0.0 s |   0.0 s |     3.5 s |
| e2e (0)                |      13/14 | 2.0 s | 57.0 s |    31.0 s |   2.0 s |    91.0 s |
| e2e                    |        0/6 |     — |      — |         — |       — |         — |
| pwa                    |        0/6 |     — |      — |         — |       — |         — |

## Baseline: full runs only (push/schedule)

| Job                    | OK / total | Queue |  Setup | Execution | Cleanup | Job total |
| ---------------------- | ---------: | ----: | -----: | --------: | ------: | --------: |
| changes                |      10/10 | 2.0 s |  7.5 s |     0.0 s |   0.0 s |     8.0 s |
| lint                   |      10/10 | 2.0 s | 21.0 s |    32.5 s |   0.5 s |    54.5 s |
| backend-tests          |      10/10 | 2.0 s | 31.0 s |   303.0 s |   1.0 s |   334.0 s |
| pwa (iphone-webkit)    |       0/10 |     — |      — |         — |       — |         — |
| pwa (desktop-chromium) |      10/10 | 2.0 s | 45.5 s |    47.5 s |   1.0 s |    95.0 s |
| frontend-unit (2)      |       9/10 | 2.0 s | 53.0 s |   118.0 s |   1.0 s |   175.0 s |
| e2e (1)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (3)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (6)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (2)                |       0/10 |     — |      — |         — |       — |         — |
| pwa (android-chromium) |       0/10 |     — |      — |         — |       — |         — |
| frontend-unit (1)      |       9/10 | 2.0 s | 48.0 s |   112.0 s |   1.0 s |   166.0 s |
| e2e (5)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (8)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (7)                |       0/10 |     — |      — |         — |       — |         — |
| e2e (4)                |       0/10 |     — |      — |         — |       — |         — |
| test                   |       0/10 |     — |      — |         — |       — |         — |

## Decisions

- Full CI on pushes to **main and test**, nightly and dispatch; safe related selection remains on PRs. Workflow/config/dependency changes still force full Vitest suites. No tests or coverage thresholds removed. Eight E2E shards and all three PWA projects retained for full events; browser smoke retained for PRs.
- Separate Oxlint, frontend/backend typecheck, frontend/backend build, backend unit and three isolated integration shards. Four frontend shards replace two. Required `test` aggregates every check. Increased concurrency trades some GitHub runner minutes for shorter feedback; no external runners/services.
- Only selection needs history: blobless checkout with full commit ancestry; other jobs retain checkout's default depth 1.
- Cache npm downloads using per-project relative paths and OS/architecture/Node22/lockfile key, without branch names, with a compatible npm-cache fallback. Main/test full runs seed base-branch caches for future PRs. PR merge caches cannot seed main/test; the first run of this new namespace is cold until those base workflows run after merge. Existing setup-node caches were present on main: this was fragmentation/path differences, not proof that every prior cache missed.
- `node_modules` rejected: each project is about 540 MB unpacked; warm npm ci measured ~6 s locally / ~7 s backend on GitHub. Keep clean installs and avoid archiving/reusing native binaries and generated Prisma output. Cache downloads, regenerate Prisma explicitly.
- No ESLint exists: both existing `lint` scripts are `tsc --noEmit` and remain unchanged. Oxlint is additive, measured <1 s locally over source/scripts; its default correctness rules report existing warnings while debugger/unreachable/constant-binary-expression errors block. It cannot replace typechecking. Formatting is checked only on changed push files; no repository-wide reformat.
- Backend unit Vitest forks baseline: **12.84 s / 1,020 tests**. Threads with isolation and restoreMocks/unstubEnvs/unstubGlobals: **10.02, 9.73, 9.02 s**, all 1,020 passed in each run (median 9.73 s, ~24% lower). Local Node 24 / 8-core host, maxWorkers=2 in both candidates; runner timings reported separately below. Keep isolate=true: mock-heavy suites do not justify weakening per-file isolation. Integration stays isolated, serial per shard/database. Frontend keeps forks unless its own complete-suite experiment passes the same stability gate.
- CPU budgets: Vitest unit workers=min(2, availableParallelism), integration=1 per database, E2E=max(1, availableParallelism−1) in CI, PWA=1. Reserve CPU/memory for jsdom, browser, Vite and Fastify rather than starting workers for every reported host core.
- Husky pre-push checks the union of **outgoing committed refs**, including earlier unpushed commits; handles new branches, ref deletions and literal filenames. Prettier/Oxlint inspect changed files. TypeScript retains complete affected project graphs, parallel with incremental metadata under ignored node_modules caches. Backend source edits also check frontend dependents. `npm run format:changed` fixes formatting; `npm run check:push` checks the outgoing diff manually. `npm ci` installs hooks via prepare; CI disables hooks with HUSKY=0.

## Existing full-suite failures

All ten baseline full runs failed all eight E2E shards and iPhone PWA; Android PWA also failed on those runs. These are not successful 20-minute runtimes to beat. Example [baseline run](https://github.com/Matitisco/iManager/actions/runs/41370700261): E2E account-lines fails a text assertion; iPhone install-help fails a state assertion and update-toast visibility. Application/test behavior is outside this tooling change; retain checks and report any recurrence. No speedup claim for failed cohorts.

## After

Pending actual PR/dispatch runs; no projected numbers are presented as measured.

## Baseline provenance

| Run                                                                           | Event        | Branch                           | Result    |
| ----------------------------------------------------------------------------- | ------------ | -------------------------------- | --------- |
| [41370700261](https://github.com/Matitisco/iManager/actions/runs/41370700261) | push         | main                             | failure   |
| [41369653147](https://github.com/Matitisco/iManager/actions/runs/41369653147) | pull_request | feat/dashboard-default-7d        | success   |
| [41369207710](https://github.com/Matitisco/iManager/actions/runs/41369207710) | pull_request | feat/admin-store-reset           | success   |
| [41369151334](https://github.com/Matitisco/iManager/actions/runs/41369151334) | push         | main                             | failure   |
| [41368168781](https://github.com/Matitisco/iManager/actions/runs/41368168781) | pull_request | feat/697-dolar-giro              | success   |
| [41367965609](https://github.com/Matitisco/iManager/actions/runs/41367965609) | push         | main                             | failure   |
| [41367919112](https://github.com/Matitisco/iManager/actions/runs/41367919112) | push         | main                             | failure   |
| [41366108695](https://github.com/Matitisco/iManager/actions/runs/41366108695) | pull_request | feat/ventas-precio-unit-ganancia | success   |
| [41363405493](https://github.com/Matitisco/iManager/actions/runs/41363405493) | pull_request | feat/admin-store-reset           | success   |
| [41363313094](https://github.com/Matitisco/iManager/actions/runs/41363313094) | pull_request | feat/admin-store-reset           | cancelled |
| [41309720674](https://github.com/Matitisco/iManager/actions/runs/41309720674) | schedule     | main                             | failure   |
| [41266860617](https://github.com/Matitisco/iManager/actions/runs/41266860617) | pull_request | feat/admin-inventory-import      | success   |
| [41199732280](https://github.com/Matitisco/iManager/actions/runs/41199732280) | schedule     | main                             | failure   |
| [41168955996](https://github.com/Matitisco/iManager/actions/runs/41168955996) | push         | main                             | failure   |
| [41168397607](https://github.com/Matitisco/iManager/actions/runs/41168397607) | pull_request | fix/correccion-ventas-admin      | success   |
| [41168320014](https://github.com/Matitisco/iManager/actions/runs/41168320014) | pull_request | fix/correccion-ventas-admin      | cancelled |
| [41167974667](https://github.com/Matitisco/iManager/actions/runs/41167974667) | push         | main                             | failure   |
| [41166930814](https://github.com/Matitisco/iManager/actions/runs/41166930814) | pull_request | temp/staff-ver-financieros       | success   |
| [41166836123](https://github.com/Matitisco/iManager/actions/runs/41166836123) | pull_request | temp/staff-ver-financieros       | cancelled |
| [41166218447](https://github.com/Matitisco/iManager/actions/runs/41166218447) | pull_request | temp/staff-ver-financieros       | failure   |
| [41166105278](https://github.com/Matitisco/iManager/actions/runs/41166105278) | pull_request | temp/staff-ver-financieros       | cancelled |
| [41166085713](https://github.com/Matitisco/iManager/actions/runs/41166085713) | pull_request | fix/ventas-test-fecha-fija       | success   |
| [41165556897](https://github.com/Matitisco/iManager/actions/runs/41165556897) | pull_request | temp/staff-ver-financieros       | failure   |
| [41163026036](https://github.com/Matitisco/iManager/actions/runs/41163026036) | push         | main                             | failure   |
| [41155105646](https://github.com/Matitisco/iManager/actions/runs/41155105646) | pull_request | feat/posthog-sale-detail         | success   |
| [41151547070](https://github.com/Matitisco/iManager/actions/runs/41151547070) | push         | main                             | failure   |
| [41150715973](https://github.com/Matitisco/iManager/actions/runs/41150715973) | pull_request | feat/columna-cantidad-ventas     | success   |
| [41149089950](https://github.com/Matitisco/iManager/actions/runs/41149089950) | pull_request | fix/precio-por-unidad            | success   |
| [41148464508](https://github.com/Matitisco/iManager/actions/runs/41148464508) | pull_request | fix/ventas-ganancia-total        | success   |
| [41147023765](https://github.com/Matitisco/iManager/actions/runs/41147023765) | pull_request | fix/cantidad-lista-ventas        | success   |

## References

- [Dependency cache scope and matching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [Vitest performance guidance](https://vitest.dev/guide/improving-performance.html)
- [Oxlint documentation](https://oxc.rs/docs/guide/usage/linter.html)
- Inspiration: Owen Gretzinger, “How I made our CI 20x faster (steal this)”, October 30, 2026; the requested optimization checklist is applied to this repository's measured bottlenecks, without its paid runner option.
