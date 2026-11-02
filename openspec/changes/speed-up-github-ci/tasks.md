## CI and tooling

- [x] Collect 30 baseline runs and identify critical paths.
- [x] Separate independent checks and integration shards without reducing selection.
- [x] Share branch-visible dependency caches and minimize checkout history.
- [x] Benchmark Oxlint and Vitest candidates; retain only justified changes.
- [x] Add and test changed-file pre-push checks below 15 seconds.
- [ ] Verify checks and record measured per-job after timings.
- [x] Commit, push ci/speedup-2 and open PR against test.

## Backend and frontend

- [x] Verify both TypeScript projects; no application or schema changes.
