## Why
Platform administrators need a precise, read-only preview of the Inventory rows that the duplicate grouping script would consolidate.

## What Changes
Add GET /admin/inventory-duplicates with strict store selection, the script’s SQL key and exclusions, complete rows, field comparisons, normalized near matches and conserved-unit totals.

## Capabilities
### New Capabilities
- `admin-inventory-duplicates`: inspect strict duplicate plans and normalized near matches.

## Impact
Backend admin module and integration tests only. No Prisma schema changes.

## Non-goals
No writes, consolidation, audit events, new credentials, frontend or production/main deployment.
