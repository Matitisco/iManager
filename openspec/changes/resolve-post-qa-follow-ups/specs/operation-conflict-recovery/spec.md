## ADDED Requirements

### Requirement: Concurrent operations preserve atomic effects
The backend SHALL retry serialization failures with a bounded policy and roll back every failed attempt before retrying.

#### Scenario: Independent stores create sales concurrently
- **WHEN** sales are created concurrently in independent stores
- **THEN** each successful response corresponds to one sale with a unique number inside its store and correct stock and client totals

#### Scenario: Same sale cancelled concurrently
- **WHEN** two requests cancel the same integrated sale
- **THEN** both succeed idempotently and stock, cash, credit, commissions and notifications are reverted at most once

#### Scenario: Two cancellations share a client
- **WHEN** concurrent requests cancel distinct sales for the same client
- **THEN** both sales are cancelled and the client's aggregate totals reflect both reversals exactly once

### Requirement: Exhausted conflicts are actionable
The API SHALL return a safe HTTP 409 for serialization conflicts that exhaust retries and SHALL NOT expose internal database details.

#### Scenario: Conflict persists
- **WHEN** all transaction attempts fail with a serialization conflict
- **THEN** the caller receives a Spanish retry instruction and no partial operation is committed
