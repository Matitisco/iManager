## Why

Measured GitHub CI repeats dependency setup, serializes backend suites, and does not run full coverage on pushes to test. Improve feedback on free GitHub runners using measured timings.

## What Changes

Preserve TypeScript, all selected tests and full main/test suites. Separate independent checks, shard integration on isolated databases, use branch-visible dependency caches and blobless history, benchmark Vitest pools, add a changed-file pre-push hook and reproducible timing reports.

## Non-goals

No production, secrets, main commits, paid runners, application/schema changes or reduced test coverage. Deliver on ci/speedup-2 in a PR against test.

## Impact

CI/tooling only; Inventory, Sales, Clients and AppContext behavior remain unchanged.
