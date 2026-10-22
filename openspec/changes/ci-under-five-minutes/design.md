# Design

The existing changes job reads the locked @playwright/test version and exposes
the official noble image as a job output. Browser jobs use that image, whose
browsers and OS dependencies are preinstalled, with shared IPC for Chromium.
No apt operations or browser cache restoration remain in those jobs.

The E2E job connects to its PostgreSQL service using the `postgres` hostname,
since localhost inside the test container refers to the test container itself.
Other runner jobs retain their existing localhost database URL.

Frontend tests use jsdom but seven test files launch Chromium directly for real
layout/animation assertions. They also import backend code, so both npm projects
are required. Install each once and overlap their installation. Keep two Vitest
shards: their measured 90-second runtime already fits the target once apt is
removed; backend integration at roughly 3.5 minutes remains the expected longest
job. Changing its database concurrency is outside this fix.

Cache keys cover both lockfiles where both projects are installed, and only the
relevant lockfile in backend-only and frontend-only jobs. Keep retries, timeouts,
all test commands and cancel-in-progress unchanged. Actual PR wall-clock timing
must be verified on a hosted run; queue and image download times vary.

## Validation

- PyYAML parsed the workflow; all run blocks passed `bash -n`.
- Compared test steps and their conditions against HEAD: unchanged. Verified
  container image output (`v1.59.1-noble`), E2E database hostname, npm cache
  scopes, required-job aggregation and concurrency cancellation.
- Exercised parallel install commands with stubbed npm success/failure results:
  either project's failure fails the step (all four combinations checked).
- Frontend and backend `npm run lint` passed.
- `npx --no-install vitest run` completed in 85.95 seconds: 183 files and 1,485
  tests passed. Seven browser suites failed during Chromium launch because this
  local sandbox denies the shutdown operation; their 42 tests could not execute.
  No test files, assertions, exclusions or skip settings were changed.
- Local dependencies were copied from an existing checkout with identical root
  and backend lockfiles. No build, commit, push or hosted workflow was run.
- The local environment has no Docker executable and registry network access is
  unavailable, so image execution and the under-five-minute wall-clock target
  remain to be confirmed by the next hosted PR run.
