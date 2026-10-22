## ADDED Requirements

### Requirement: Completed calendar periods
The system SHALL show Resumen periódico within Reportes and select the latest completed fortnight or month in the business timezone, with previous periods in a grouped selector and no date range below the period chips.

#### Scenario: Midmonth and month boundaries
- **WHEN** the business date is the 16th
- **THEN** Última quincena covers the 1st through the 15th and Último mes covers the preceding complete month

### Requirement: Tenant-scoped audit totals
The system SHALL read only the member's store, respect Reportes and module permissions, exclude all voided sales from totals and preserve their struck-through audit rows.

#### Scenario: Voided sale
- **WHEN** a sale has CANCELADA, ANULADA, cancelledAt or voidedAt
- **THEN** it may appear in the breakdown but contributes zero to the total

### Requirement: Returns and physical discrepancies
The system SHALL display settled refund/credit amounts and open RMA, and distinct devices with differences from closed physical counts in the selected period.

#### Scenario: Closed snapshots
- **WHEN** multiple closed counts contain the same discrepant IMEI
- **THEN** the device counts once with its latest discrepancy, while open counts and legitimate sales during counting are excluded

### Requirement: Responsive breakdown and query states
The system SHALL provide three responsive cards, complete breakdowns in the shared modal infrastructure, visible failure/retry, skeleton loading, currency-aware totals and the approved v3b empty states.

#### Scenario: Complete breakdown
- **WHEN** a user selects Ver todas (n) on any card at 390px or 1440px
- **THEN** a modal opens with every record for that card without navigation, keeps keyboard focus inside and restores focus to the trigger on close

#### Scenario: Voided row presentation
- **WHEN** a voided sale appears in a preview or modal
- **THEN** its amount is struck through with no cancellation caption and it does not contribute to the total

#### Scenario: Failed or stale request
- **WHEN** a request fails or the tenant/period changes
- **THEN** the screen does not present previous data as the current summary or turn a failure into a zero total

#### Scenario: Empty period
- **WHEN** the period has no records
- **THEN** cards show only their titles and zero totals, without helper captions or breakdown buttons
