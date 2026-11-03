## ADDED Requirements

### Requirement: Consistent claim cancellation
Returns SHALL reject cancellation with HTTP 409 and a Spanish message requesting prior reversal of the refund or credit note whenever compensation has been issued, including a credit note already used.

#### Scenario: Compensated partial return
- **WHEN** an authorized actor cancels a partially compensated USD or ARS claim
- **THEN** claim, stock, customer totals, cash, note applications, revenue and profit remain unchanged

#### Scenario: Cancellation without compensation
- **WHEN** an authorized actor cancels a claim without compensation
- **THEN** the system SHALL reverse its physical effects atomically with cancellation and preserve the sale's revenue, profit and customer total

#### Scenario: Stock changed after resolution
- **WHEN** reversing physical effects would affect a reservation, resale or ambiguous stock
- **THEN** the system SHALL reject cancellation without partial writes

#### Scenario: Staff permissions
- **WHEN** STAFF lacks sensitive access
- **THEN** cancellation SHALL remain forbidden and the financial visibility granted by #691 SHALL remain unchanged
