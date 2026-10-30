## ADDED Requirements

### Requirement: Read-only duplicate inventory inspection
The backend SHALL expose GET /admin/inventory-duplicates only to verified ADMIN_EMAILS users, require exactly one storeEmail/storeId, reject unknown query keys, and return no-store responses.

#### Scenario: Invalid access or store selection
- **WHEN** authentication, authorization or query validation fails, or owner lookup is missing/ambiguous or the expected store name mismatches
- **THEN** return 401, 403, 400, 404 or 409 as appropriate without writes.

### Requirement: Exact grouping and diagnostic near matches
The report SHALL use the reference script’s strict SQL key, candidates and exclusion reasons, report full rows and field differences, preserve units, and present normalized near matches separately without simulated consolidation.

#### Scenario: Strict duplicates with excluded and near rows
- **WHEN** a store has eligible strict duplicates, excluded candidates and normalized-only matches
- **THEN** keep the oldest eligible row per strict group, simulate drops only for its eligible peers, report exclusions only for strict candidate groups of at least two, and flag unexpected differences and normalized-only matches.

### Requirement: Database enforced read-only snapshot
All report database reads SHALL run in one READ ONLY RepeatableRead transaction, including store lookup, and the endpoint SHALL leave every database row unchanged.

#### Scenario: Accidental mutation
- **WHEN** a write is attempted inside the report transaction
- **THEN** PostgreSQL rejects it; normal reports preserve all rows and produce deterministic ordering.
