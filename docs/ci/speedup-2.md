# CI speedup measurements

## Scope and method

Baseline collected **before editing**: last 30 CI runs, 318 jobs, October 30–November 2, 2026 UTC (20 PR, 8 main push, 2 scheduled). 14 successful workflows, 12 failed and 4 cancelled. All jobs use free GitHub-hosted `ubuntu-latest` runners; browser images remain lockfile-matched Playwright.

Reproduce with `node scripts/ci-timings.mjs collect /tmp/ci.json` and `node scripts/ci-timings.mjs report /tmp/ci.json`. Pass explicit run IDs after the output path to compare the same cohort. Measurements use GitHub job/step timestamps (one-second resolution), **medians of successful jobs only**. Failed/cancelled/skipped jobs remain in denominators, never count as a speedup. Queue is job `created_at → started_at` (excludes dependency wait before job creation); setup is job duration minus execution and cleanup. Execution includes lint/typecheck/build/test/selection steps; cleanup includes post-actions/container stop. Unattributed gaps stay in setup. Component medians need not sum to the median total. Full versus related-test cohorts must be compared separately.

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
- Cache npm downloads using per-project relative paths and OS/architecture/Node22/lockfile key, without branch names, with a compatible npm-cache fallback. Cache metadata/logs confirm two compression versions: hosted Ubuntu has zstd, Playwright containers use gzip. Both host/container job types run on main/test and seed their compatible format; both formats are seeded by the corresponding base-branch jobs without adding package-manager setup to every browser runner. Main/test full runs seed base-branch caches for future PRs. PR merge caches cannot seed main/test. The first run of the new namespace is cold; later pushes to the same PR reuse its merge-ref caches. New PRs can reuse base caches after those main/test workflows run following merge. Existing setup-node caches were present on main: this was fragmentation/path differences, not proof that every prior cache missed.
- `node_modules` rejected: each project is about 540 MB unpacked; warm npm ci measured ~6 s locally / ~7 s backend on GitHub. Keep clean installs and avoid archiving/reusing native binaries and generated Prisma output. Cache downloads, regenerate Prisma explicitly.
- No ESLint exists: both existing `lint` scripts are `tsc --noEmit` and remain unchanged. Oxlint is additive, measured <1 s locally over source/scripts; its default correctness rules report existing warnings while debugger/unreachable/constant-binary-expression errors block. It cannot replace typechecking. Formatting is checked only on changed push files; no repository-wide reformat.
- Backend unit Vitest forks baseline: **12.84 s / 1,020 tests**. Threads with isolation and restoreMocks/unstubEnvs/unstubGlobals: **10.02, 9.73, 9.02 s**, all 1,020 passed in each run (median 9.73 s, ~24% lower). Local Node 24 / 8-core host, maxWorkers=2 in both candidates; runner timings reported separately below. Keep isolate=true: mock-heavy suites do not justify weakening per-file isolation. Integration stays isolated, serial per shard/database. Frontend threads were rejected: one complete run took **430.01 s**, with **1 failure / 2,587 tests** in `sheet-detail.test.tsx`, versus forks **174.87 s / 2,587 passed**. No isolation/pool change applied to frontend. A warm backend forks confirmation passed all 1,020 tests in **10.30 s**: against this fairer warm comparison, threads median is ~5.5% faster; the 24% figure above is versus the initial run only.
- CPU budgets: Vitest unit workers=min(2, availableParallelism), integration=1 per database, E2E=max(1, availableParallelism−1) in CI, PWA=1. Reserve CPU/memory for jsdom, browser, Vite and Fastify rather than starting workers for every reported host core.
- Husky pre-push checks the union of **outgoing committed refs**, including earlier unpushed commits; handles new branches, ref deletions and literal filenames. Prettier/Oxlint inspect changed files. TypeScript retains complete affected project graphs, parallel with incremental metadata under ignored node_modules caches. Backend source edits also check frontend dependents. `npm run format:changed` fixes formatting; `npm run check:push` checks the outgoing diff manually. `npm ci` installs hooks via prepare; CI disables hooks with HUSKY=0.

## Existing full-suite failures

All ten baseline full runs failed all eight E2E shards and iPhone PWA; Android PWA also failed on those runs. These are not successful 20-minute runtimes to beat. Example [baseline run](https://github.com/Matitisco/iManager/actions/runs/41370700261): E2E account-lines fails a text assertion; iPhone install-help fails a state assertion and update-toast visibility. Application/test behavior is outside this tooling change; retain checks and report any recurrence. No speedup claim for failed cohorts.

## After: PR run (first cache population)

[PR run 41373158821](https://github.com/Matitisco/iManager/actions/runs/41373158821), commit `1873322`, **all 17 jobs passed**. This PR changes workflow/config/dependencies, so it ran the **complete frontend/unit/integration suites**, plus existing PR browser smoke. One after sample is evidence for this commit, not a statistically significant median improvement.

| Job                     | OK / total | Queue |  Setup | Execution | Cleanup | Job total |
| ----------------------- | ---------: | ----: | -----: | --------: | ------: | --------: |
| changes                 |        1/1 | 2.0 s |  6.0 s |     1.0 s |   0.0 s |     7.0 s |
| typecheck (backend)     |        1/1 | 1.0 s | 20.0 s |    12.0 s |   1.0 s |    33.0 s |
| build (frontend)        |        1/1 | 1.0 s | 22.0 s |    13.0 s |   1.0 s |    36.0 s |
| lint                    |        1/1 | 1.0 s | 15.0 s |     0.0 s |   3.0 s |    18.0 s |
| build (backend)         |        1/1 | 1.0 s | 17.0 s |    12.0 s |   2.0 s |    31.0 s |
| typecheck (frontend)    |        1/1 | 1.0 s | 24.0 s |    13.0 s |   1.0 s |    38.0 s |
| backend-unit            |        1/1 | 2.0 s | 23.0 s |    14.0 s |   0.0 s |    37.0 s |
| pwa (android-chromium)  |        1/1 | 2.0 s | 46.0 s |    20.0 s |   8.0 s |    74.0 s |
| e2e (0)                 |        1/1 | 2.0 s | 61.0 s |    30.0 s |  12.0 s |   103.0 s |
| backend-integration (1) |        1/1 | 2.0 s | 34.0 s |   108.0 s |   2.0 s |   144.0 s |
| frontend-unit (4)       |        1/1 | 2.0 s | 48.0 s |    51.0 s |   6.0 s |   105.0 s |
| frontend-unit (3)       |        1/1 | 2.0 s | 49.0 s |    71.0 s |   8.0 s |   128.0 s |
| frontend-unit (2)       |        1/1 | 2.0 s | 51.0 s |    64.0 s |   7.0 s |   122.0 s |
| backend-integration (2) |        1/1 | 2.0 s | 34.0 s |   161.0 s |   2.0 s |   197.0 s |
| frontend-unit (1)       |        1/1 | 4.0 s | 45.0 s |    57.0 s |   7.0 s |   109.0 s |
| backend-integration (3) |        1/1 | 2.0 s | 27.0 s |    53.0 s |   1.0 s |    81.0 s |
| test                    |        1/1 | 3.0 s |  3.0 s |     0.0 s |   0.0 s |     3.0 s |

### Comparable successful PR cohort

Four baseline successful PR runs had full frontend/unit/integration suites and browser smoke: [41266860617](https://github.com/Matitisco/iManager/actions/runs/41266860617), [41166930814](https://github.com/Matitisco/iManager/actions/runs/41166930814), [41155105646](https://github.com/Matitisco/iManager/actions/runs/41155105646), [41149089950](https://github.com/Matitisco/iManager/actions/runs/41149089950). Workflow wall time median **393 s** (391 / 395 / 320 / 535 s); first after PR **215 s**, approximately **45% lower**. These control for workflow profile, not application revision or runner load; the after PR includes the current test suite and additional independent builds/lint.

| Job                    | OK / total | Queue |  Setup | Execution | Cleanup | Job total |
| ---------------------- | ---------: | ----: | -----: | --------: | ------: | --------: |
| changes                |        4/4 | 2.5 s |  6.0 s |     0.0 s |   0.5 s |     6.5 s |
| pwa (android-chromium) |        4/4 | 2.0 s | 46.5 s |    16.5 s |   2.5 s |    65.0 s |
| frontend-unit (1)      |        4/4 | 2.0 s | 51.0 s |   142.5 s |   1.0 s |   196.5 s |
| backend-tests          |        4/4 | 2.0 s | 35.0 s |   285.0 s |   1.0 s |   322.0 s |
| lint                   |        4/4 | 2.0 s | 23.5 s |    26.0 s |   0.5 s |    53.0 s |
| e2e (0)                |        4/4 | 2.0 s | 56.5 s |    27.0 s |   2.0 s |    85.0 s |
| frontend-unit (2)      |        4/4 | 2.0 s | 50.5 s |   143.5 s |   1.0 s |   191.5 s |
| test                   |        4/4 | 3.5 s |  3.5 s |     0.0 s |   0.0 s |     4.0 s |

| Check                               | Comparable baseline job median |                            First after PR | Observation                                                    |
| ----------------------------------- | -----------------------------: | ----------------------------------------: | -------------------------------------------------------------- |
| Combined backend unit + integration |                          322 s |   unit 37 s; integration 144 / 197 / 81 s | Longest backend job 197 s, ~39% lower                          |
| Frontend full suite                 |     196.5 / 191.5 s (2 shards) |        109 / 122 / 128 / 105 s (4 shards) | Longest frontend job 128 s, ~35% lower                         |
| Combined TypeScript lint            |                           53 s | frontend 38 s / backend 33 s; Oxlint 18 s | Longest independent check 38 s, ~28% lower; Oxlint adds checks |
| Frontend/backend build              |        No dedicated build jobs |                                 36 / 31 s | Additional independent verification; PWA builds retained       |
| PR E2E smoke                        |                           85 s |                                     103 s | First new-cache run is slower; no speedup claim                |
| PR Android PWA smoke                |                           65 s |                                      74 s | First new-cache run is slower; no speedup claim                |
| Selection                           |                          6.5 s |                                       7 s | Blobless ancestry retains merge-base semantics                 |
| Required aggregator                 |                            4 s |                                       3 s | All required checks retained                                   |

**Coverage verification:** parsed actual successful PR job logs and compared their file union with Vitest's full file inventory. Frontend: **258 files / 2,587 tests**, distributed 65/65/64/64 files. Integration: **75 files / 688 tests**, 25 files in each shard. Exact union, no missing or duplicate files. Backend unit: all 1,020 tests retained. Frontend forks baseline also passed all 2,587 locally. Coverage includes the same test inventories; no code-coverage threshold changes.

Hook measured **14.00 s cold** and **2.34 s warm** on the actual first push (22 changed files, both TypeScript projects); subsequent tooling-only push **0.23 s**. Deleted source paths retain project typechecks, and renames are expanded into deletion/addition to retain checks across project boundaries.

## After: complete dispatch

[Full dispatch 41373158688](https://github.com/Matitisco/iManager/actions/runs/41373158688), same commit `1873322`. All frontend, backend unit/integration, lint/typecheck/build and desktop PWA checks passed. All eight E2E shards plus Android/iPhone PWA failed, matching the baseline failing job set. E2E shard 1 reproduces the same four final failing tests as the baseline (account-lines, both bulk-actions cases, delete-cancelled-trade-ins); iPhone/Android install-help reproduces the accordion assertion. These checks remain active and block the aggregate. **No successful full-workflow speedup claim.** Some queue times increased to 129 s while full dispatch and PR competed for free runner capacity; extra sharding does not remove account concurrency limits.

Successful jobs:

| Job                     | OK / total |   Queue |  Setup | Execution | Cleanup | Job total |
| ----------------------- | ---------: | ------: | -----: | --------: | ------: | --------: |
| changes                 |        1/1 |   2.0 s |  8.0 s |     1.0 s |   0.0 s |     9.0 s |
| typecheck (backend)     |        1/1 |   2.0 s | 24.0 s |    14.0 s |   1.0 s |    39.0 s |
| lint                    |        1/1 |   2.0 s | 18.0 s |     0.0 s |   4.0 s |    22.0 s |
| build (frontend)        |        1/1 |   2.0 s | 23.0 s |    12.0 s |   1.0 s |    36.0 s |
| typecheck (frontend)    |        1/1 |   2.0 s | 23.0 s |    18.0 s |   2.0 s |    43.0 s |
| build (backend)         |        1/1 |   3.0 s | 17.0 s |    10.0 s |   5.0 s |    32.0 s |
| backend-integration (2) |        1/1 |  24.0 s | 28.0 s |    96.0 s |   1.0 s |   125.0 s |
| frontend-unit (3)       |        1/1 |  23.0 s | 51.0 s |    73.0 s |   8.0 s |   132.0 s |
| frontend-unit (2)       |        1/1 |  28.0 s | 45.0 s |    51.0 s |   6.0 s |   102.0 s |
| frontend-unit (1)       |        1/1 |  15.0 s | 48.0 s |    60.0 s |  10.0 s |   118.0 s |
| pwa (desktop-chromium)  |        1/1 |  37.0 s | 46.0 s |    52.0 s |   4.0 s |   102.0 s |
| frontend-unit (4)       |        1/1 |  36.0 s | 51.0 s |    67.0 s |   7.0 s |   125.0 s |
| pwa (android-chromium)  |        0/1 |       — |      — |         — |       — |         — |
| pwa (iphone-webkit)     |        0/1 |       — |      — |         — |       — |         — |
| e2e (4)                 |        0/1 |       — |      — |         — |       — |         — |
| backend-integration (3) |        1/1 |  28.0 s | 28.0 s |    47.0 s |   1.0 s |    76.0 s |
| backend-integration (1) |        1/1 |  81.0 s | 30.0 s |   114.0 s |   1.0 s |   145.0 s |
| backend-unit            |        1/1 | 104.0 s | 22.0 s |    17.0 s |   1.0 s |    40.0 s |
| e2e (1)                 |        0/1 |       — |      — |         — |       — |         — |
| e2e (2)                 |        0/1 |       — |      — |         — |       — |         — |
| e2e (5)                 |        0/1 |       — |      — |         — |       — |         — |
| e2e (7)                 |        0/1 |       — |      — |         — |       — |         — |
| e2e (6)                 |        0/1 |       — |      — |         — |       — |         — |
| e2e (3)                 |        0/1 |       — |      — |         — |       — |         — |
| e2e (8)                 |        0/1 |       — |      — |         — |       — |         — |
| test                    |        0/1 |       — |      — |         — |       — |         — |

Failed jobs (diagnostic durations, **not a speedup**):

| Job                    | failure / total |   Queue |  Setup | Execution | Cleanup | Job total |
| ---------------------- | --------------: | ------: | -----: | --------: | ------: | --------: |
| pwa (android-chromium) |             1/1 | 106.0 s | 54.0 s |   126.0 s |   0.0 s |   180.0 s |
| pwa (iphone-webkit)    |             1/1 |  75.0 s | 43.0 s |    98.0 s |   1.0 s |   142.0 s |
| e2e (4)                |             1/1 |  10.0 s | 66.0 s |   174.0 s |   2.0 s |   242.0 s |
| e2e (1)                |             1/1 |  30.0 s | 76.0 s |   295.0 s |   2.0 s |   373.0 s |
| e2e (2)                |             1/1 |  31.0 s | 61.0 s |   659.0 s |   1.0 s |   721.0 s |
| e2e (5)                |             1/1 |  26.0 s | 64.0 s |   287.0 s |   1.0 s |   352.0 s |
| e2e (7)                |             1/1 | 123.0 s | 62.0 s |   295.0 s |   2.0 s |   359.0 s |
| e2e (6)                |             1/1 | 106.0 s | 66.0 s |   195.0 s |   1.0 s |   262.0 s |
| e2e (3)                |             1/1 | 112.0 s | 59.0 s |   282.0 s |   1.0 s |   342.0 s |
| e2e (8)                |             1/1 | 129.0 s | 60.0 s |   212.0 s |   1.0 s |   273.0 s |
| test                   |             1/1 |   2.0 s |  2.0 s |     0.0 s |   0.0 s |     2.0 s |

## Baseline failed jobs: diagnostic timing

Separate failed-job medians preserve visibility into setup/queue/execution even when the check did not pass. Reproduce with `node scripts/ci-timings.mjs report /tmp/ci.json failure`. Interrupted/skipped jobs remain counted in the cohort and are excluded from speedup comparisons.

| Job                    | failure / total | Queue |  Setup | Execution | Cleanup | Job total |
| ---------------------- | --------------: | ----: | -----: | --------: | ------: | --------: |
| backend-tests          |            2/30 | 2.0 s | 30.5 s |   261.0 s |   0.5 s |   292.0 s |
| pwa (iphone-webkit)    |           10/10 | 2.0 s | 46.5 s |    94.0 s |   1.0 s |   139.0 s |
| frontend-unit (2)      |            1/18 | 3.0 s | 51.0 s |   140.0 s |   1.0 s |   192.0 s |
| e2e (1)                |           10/10 | 2.0 s | 63.5 s |   263.0 s |   2.0 s |   326.5 s |
| e2e (3)                |           10/10 | 2.0 s | 63.5 s |   282.5 s |   2.0 s |   343.0 s |
| e2e (6)                |           10/10 | 2.0 s | 61.5 s |   165.5 s |   1.0 s |   230.0 s |
| e2e (2)                |           10/10 | 2.0 s | 59.5 s |   465.0 s |   2.0 s |   530.0 s |
| pwa (android-chromium) |           10/24 | 2.0 s | 46.5 s |   129.5 s |   1.0 s |   177.5 s |
| frontend-unit (1)      |            2/30 | 2.5 s | 55.5 s |   121.0 s |   0.5 s |   177.0 s |
| e2e (5)                |           10/10 | 2.0 s | 63.5 s |   345.5 s |   1.5 s |   412.5 s |
| e2e (8)                |           10/10 | 2.0 s | 61.5 s |   329.5 s |   1.5 s |   395.0 s |
| e2e (7)                |           10/10 | 2.0 s | 62.5 s |   378.0 s |   1.0 s |   442.0 s |
| e2e (4)                |           10/10 | 2.0 s | 60.5 s |   192.5 s |   1.5 s |   258.5 s |
| test                   |           16/30 | 2.0 s |  3.0 s |     0.0 s |   0.0 s |     3.0 s |

## After: warm-cache PR

[PR run 41374133994](https://github.com/Matitisco/iManager/actions/runs/41374133994), commit `55754c8`, **all 17 jobs passed**. Wall time **205 s (3 min 25 s)**, ~48% below the comparable baseline median of 393 s. Logs explicitly show exact-key npm cache restores in hosted integration and container frontend jobs for both projects. Cold-namespace PR: 215 s; warm PR: 205 s. Two samples show observed gains, not a universal latency guarantee.

| Job                     | OK / total | Queue |  Setup | Execution | Cleanup | Job total |
| ----------------------- | ---------: | ----: | -----: | --------: | ------: | --------: |
| changes                 |        1/1 | 3.0 s |  8.0 s |     0.0 s |   0.0 s |     8.0 s |
| build (frontend)        |        1/1 | 2.0 s | 19.0 s |    12.0 s |   1.0 s |    32.0 s |
| build (backend)         |        1/1 | 2.0 s | 15.0 s |     9.0 s |   0.0 s |    24.0 s |
| typecheck (backend)     |        1/1 | 2.0 s | 24.0 s |    14.0 s |   1.0 s |    39.0 s |
| lint                    |        1/1 | 2.0 s | 19.0 s |     1.0 s |   0.0 s |    20.0 s |
| typecheck (frontend)    |        1/1 | 3.0 s | 28.0 s |    20.0 s |   1.0 s |    49.0 s |
| pwa (android-chromium)  |        1/1 | 2.0 s | 45.0 s |    19.0 s |   1.0 s |    65.0 s |
| e2e (0)                 |        1/1 | 2.0 s | 62.0 s |    31.0 s |   2.0 s |    95.0 s |
| backend-unit            |        1/1 | 2.0 s | 17.0 s |    17.0 s |   1.0 s |    35.0 s |
| backend-integration (3) |        1/1 | 2.0 s | 27.0 s |    63.0 s |   1.0 s |    91.0 s |
| frontend-unit (2)       |        1/1 | 2.0 s | 53.0 s |    83.0 s |   1.0 s |   137.0 s |
| backend-integration (2) |        1/1 | 2.0 s | 33.0 s |   152.0 s |   1.0 s |   186.0 s |
| frontend-unit (4)       |        1/1 | 2.0 s | 55.0 s |    83.0 s |   2.0 s |   140.0 s |
| frontend-unit (1)       |        1/1 | 2.0 s | 48.0 s |    85.0 s |   2.0 s |   135.0 s |
| backend-integration (1) |        1/1 | 2.0 s | 29.0 s |   106.0 s |   1.0 s |   136.0 s |
| frontend-unit (3)       |        1/1 | 2.0 s | 47.0 s |    46.0 s |   1.0 s |    94.0 s |
| test                    |        1/1 | 2.0 s |  3.0 s |     0.0 s |   0.0 s |     3.0 s |

| Check                    | Comparable baseline | First PR | Warm PR |
| ------------------------ | ------------------: | -------: | ------: |
| Workflow wall time       |               393 s |    215 s |   205 s |
| Longest backend path job |               322 s |    197 s |   186 s |
| Longest frontend shard   |             196.5 s |    128 s |   140 s |
| Longest typecheck job    |       53 s combined |     38 s |    49 s |
| E2E smoke                |                85 s |    103 s |    95 s |
| Android PWA smoke        |                65 s |     74 s |    65 s |

Warm cache does not eliminate browser image initialization or machine variability; E2E smoke remains slower than the historical comparable median. No success claim for full E2E/PWA failures.

Final local validation: both TypeScript projects passed; **15 tooling tests passed**, actionlint passed, full frontend passed (2,587 tests), backend threads passed three complete 1,020-test trials. No local build, production access, main writes or secret changes. Full GitHub build checks passed on both PR runs. Branch delivery remains `ci/speedup-2` → `test`.

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
