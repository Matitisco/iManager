## Purpose
Clarify the measured population, comparison, availability and export scope of each Reports module.

## ADDED Requirements

### Requirement: Semantic variations
Reports SHALL show direction and readable comparison text. Monetary increases/decreases use green/red; Stock, Canjes and new-client counts use gray absolute changes. Missing conversion or previous zero SHALL never yield a fabricated percentage.
#### Scenario: Small decrease or missing base
- **WHEN** a monetary decrease rounds below one percent, or the previous amount is unavailable
- **THEN** the direction remains visible as less than one percent, or a gray unavailable explanation replaces the percentage

### Requirement: Module summaries
Stock SHALL distinguish dated entries from available inventory today and measured entry-to-sale duration. Servicio SHALL sum non-null estimates of received orders, count unquoted orders, and measure delivery only from valid events; evolution counts orders. Owner financial results SHALL appear below charts only in Ventas using unchanged financial inputs.
#### Scenario: Missing history
- **WHEN** delivered equipment or orders lack a valid entry, sale link or delivery event
- **THEN** the duration excludes unmeasurable records and discloses unavailable measurements

### Requirement: Successful data and permission scope
Reports SHALL distinguish loading, failed and successful empty data. Export SHALL require successful necessary data. Purchase-derived client information SHALL require sales permission and successful sales data, without requesting unauthorized lists.
#### Scenario: Retry failed sales
- **WHEN** sales loading fails
- **THEN** the screen shows an error and retry, disables export, and shows metrics only after successful recovery

### Requirement: Calendar commissions
Comisiones SHALL retain a separate month selection in the store timezone, request that month exactly, compare to the previous calendar month and preserve signed adjustments. CSV SHALL contain the visible category-filtered rows and original currency columns.
#### Scenario: January and negative adjustments
- **WHEN** January is selected and a member has negative accrual
- **THEN** comparison requests December of the prior year and the breakdown displays signed values without donut proportions

### Requirement: Detail filters and empty periods
Category selection SHALL restrict details and export while preserving overview totals and evolution. Empty Canjes SHALL offer a rolling thirty-day reset clearing category and bar selection.
#### Scenario: Empty trade-in period
- **WHEN** a successful response contains no trade-ins in the range
- **THEN** charts are replaced with explanatory text and a working thirty-day action
