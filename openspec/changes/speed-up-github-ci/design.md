## Approach

Collect approximately 30 recent workflow runs through gh with job/step timestamps before editing. Separate queue, setup, execution and cleanup; retain failures separately. Keep the required test aggregator. Use lockfile/OS/architecture/Node-specific dependency cache keys without branch names, seeded by full runs on main/test. Limit workers to runner CPU capacity; integration files keep one worker per independent database shard. Keep isolation unless a candidate is faster and stable on three complete runs. Evaluate Oxlint as an additional checker because existing lint commands are tsc, not ESLint. Pre-push checks the outgoing committed diff, with affected TypeScript projects retaining dependency context.

## Validation

Run frontend/backend typechecks, test-selection safety tests, benchmark baseline/candidates, validate workflow structure and observe actual GitHub PR runs. Record per-job before/after with sample sizes and distinguish full-suite from related-test runs. Do not claim successful runtime speedups from failed jobs.
