## ADDED Requirements

### Requirement: Atomic financial changes
The system SHALL validate financial writes against transaction-current balances and preserve every committed change, payment, installment allocation, cash movement and audit.

#### Scenario: Concurrent collections
- **WHEN** collections overlap on a client, sale or repair
- **THEN** successful requests SHALL be equivalent to a valid sequential execution and excess collection SHALL fail with the existing validation response.

#### Scenario: Contact edits and imports
- **WHEN** a client patch or import overlaps a financial operation
- **THEN** omitted fields SHALL remain unchanged and imported totals and stock eligibility SHALL use current transaction data.

### Requirement: Atomic stock and guarded transitions
The system SHALL revalidate eligibility inside the mutation transaction and commit stock-count adjustments, item audits and resolution atomically.

#### Scenario: Competing stock resolutions or later failure
- **WHEN** adjustments overlap or any selected item fails validation
- **THEN** only one resolution SHALL commit and unsuccessful requests SHALL leave no stock or audit changes.

#### Scenario: Archival, catalog initialization and repair changes
- **WHEN** eligible-state changes overlap
- **THEN** the system SHALL retain current sequential restrictions, create no duplicate transition history, and initialize defaults consistently with catalog saves.

### Requirement: Bounded batch reads
The system SHALL load commission report history and seller-assignment inputs in batches and batch stock adjustment association checks.

#### Scenario: Growing report or selection
- **WHEN** the number of months or selected records increases
- **THEN** read query counts SHALL remain bounded independently of that number while historical cutoffs, FIFO, currencies, rules and audits remain equivalent.

### Requirement: Current scoped frontend state
The frontend SHALL apply asynchronous responses only to the current session scope and valid read generation/ticket, preserving successful writes to independent records.

#### Scenario: Delayed read or mutation response
- **WHEN** reads, writes, logout or store changes overlap
- **THEN** obsolete responses SHALL not replace current scoped records, and an earlier failed optimistic edit SHALL not undo a later successful edit.
