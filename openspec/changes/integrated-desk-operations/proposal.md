# Integrated desk operations

## Why
Issue #89 requires a single persisted operation across Inventory, Sales, Clients and Trade-ins. Today the modules write independently, so a manual status change to sold, a draft trade-in, and a confirmed exchange can leave incomplete or duplicated business records.

## What changes
- Add transactional operation APIs that coordinate inventory, sales, client balances, trade-ins and persisted notifications.
- Connect Desk entry points to the shared flows, preserve recoverable drafts across reloads, and replace the local notification preview with per-user persistent reads and section-authorized record links.
- Add schema links and state needed to make a manual sold item pending registration, prepare/confirm/cancel exchanges, support idempotent requests, and track per-user notification reads.
- Route legacy manual sale and trade-in writes through the same business rules or reject edits that would split linked records.

## Non-goals
- No changes to inventory import semantics or retroactive generation of sale/client/trade-in records.
- No production database writes or deployment-time backfill.
