## Why
Issue #461 identifies lost financial updates, non-atomic stock adjustments, duplicate transitions, stale frontend responses and repeated commission queries on base 2e5f50b. Concurrent requests must preserve existing sequential business rules.

## What Changes
- Serialize account collections, client financial edits/archival, imported sales and repair validation.
- Make stock-count adjustment and inventory eligibility checks atomic, with batched association reads.
- Coordinate catalog initialization/save and guard expense/supplier transitions.
- Batch commission history and seller assignment inputs.
- Guard frontend initial loads, refreshes, mutation completions and optimistic rollback by session scope and record.
- Add controlled PostgreSQL concurrency, query-budget and deferred-response regression tests.

## Capabilities
### New Capabilities
- `concurrent-record-integrity`: concurrency and bounded reads across existing modules.

## Impact
Accounts, Clients, Sales/import, Inventory, Stock counts, Repairs, Catalogs, Expenses, Suppliers, Commissions, store-records, AppContext and client form PATCH payloads. No Prisma schema or HTTP contract changes.

## Non-goals
No visual changes, new financial rules, production database writes, deployment, commits, branches or push. No changes to cancellation, reservation, numbering, onboarding or invitation semantics.
