## ADDED Requirements

### Requirement: Cash operation and administration
The system SHALL prioritize daily operation and counting, separate owner administration, and display actual latest session status with local dates and opening age. Only OWNER SHALL approve or request recount. Protected balances SHALL include opening funds.

#### Scenario: No open session
- **WHEN** a register has an approved session
- **THEN** its latest closed session and result are shown without a “Sin abrir” state, and reopening is offered only on a later permitted day

#### Scenario: Daily operation
- **WHEN** a current session is open
- **THEN** counting is primary, income/outflow are secondary, conversion is tertiary and administration is separate

#### Scenario: Protected balances
- **WHEN** an authorized user cannot view balances
- **THEN** opening funds and history do not disclose protected amounts and counting remains blind

### Requirement: Expense accounting explanation
The system SHALL show monthly net-profit figures from existing reports, category filtering, original amounts and an explanation that expenses reduce net profit without recording cash outflow.

#### Scenario: Expense and cash are separate
- **WHEN** a user saves or consults an expense
- **THEN** no cash movement or retroactive relation is created and Ir a Cajas navigates without asserting payment status

#### Scenario: Archived expense
- **WHEN** the user opens an archived expense
- **THEN** existing values and restore are shown, with visible loading/failure states

### Requirement: Supplier information before actions
The system SHALL prioritize name, existing contact, devices and latest non-archived purchase, retain grouped and ungrouped devices and protect costs by permission.

#### Scenario: No contact or purchase
- **WHEN** a supplier lacks contact or purchases
- **THEN** absence is explicit without invented dates, totals or individuals from trade-ins
