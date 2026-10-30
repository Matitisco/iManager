## Context
The reference script defines exact SQL grouping and exclusions. Inventory cantidad maps to the physical quantity column.

## Decisions
- Protect the route with authenticate and requirePlatformAdmin; strict Zod query and no-store caching.
- Resolve the store and read all data in one PostgreSQL READ ONLY, RepeatableRead transaction. No session/business-context middleware that writes.
- Use the identical SQL MD5/jsonb key and EXISTS exclusions; parameterize all inputs.
- Preserve all InventoryItem columns with to_jsonb, overriding Decimal columns as strings and serializing timestamp columns as UTC ISO strings.
- Compare every column except id; separate expected variation from unexpected differences (including entryDate time lost by the day key).
- Normalize only key fields for near matches, recursively normalize JSON text values, and retain structural JSON distinctions. Near matches never create extra simulated drops or change unit totals.
- Stable SQL row ordering and explicit group sorting. Excluded top-level rows follow script semantics; near rows independently carry exclusion reasons.

## Risks
Large stores return large reports by design. A repeatable snapshot avoids concurrent changes producing inconsistent totals. Normalization is diagnostic only.

## Validation
Related access/admin integration tests with isolated local PostgreSQL, a real rejected write inside the service transaction, and a complete before/after database snapshot; frontend/backend TypeScript, no build.
