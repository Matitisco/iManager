# PR CI under five minutes

## Why

Frontend shards spend about five minutes installing browser system packages,
even on a browser cache hit. Vitest itself takes about 90 seconds per shard.

## What changes

- Run frontend, E2E and PWA browser tests in the official Playwright image,
  selected from the exact locked package version.
- Install each required npm project once, in parallel when both are needed,
  and scope npm caches to the lockfiles used by each job.
- Preserve every existing test, PR/full-suite selection and cancellation rule.

## Non-goals

No application, schema, test assertions or database isolation changes. No build
run locally, commits or pushes. Backend integration remains serial because its
fixtures truncate shared tables.
