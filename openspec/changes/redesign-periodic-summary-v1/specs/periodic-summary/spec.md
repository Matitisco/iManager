## ADDED Requirements

### Requirement: Approved summary composition
The summary SHALL present each permitted section in a card with its existing total, up to three preview rows and Ver todas in the header when records exist. It SHALL preserve existing calculations, currency conversion and permission filtering.

#### Scenario: Responsive previews
- **WHEN** the summary loads at 1440px or 390px
- **THEN** permitted cards appear in three columns or consecutive mobile cards, with complete breakdowns available in a desktop Sheet or mobile full screen with a back button

### Requirement: Consistent period controls
All three period controls SHALL measure 38px high. The historical selector SHALL show Anteriores on mobile while retaining its accessible name and the existing backend periods. The selected date range SHALL reflect the response.

#### Scenario: Historical selection
- **WHEN** a user selects a historical period
- **THEN** the real query reloads the permitted totals and details without showing stale records

### Requirement: Full voided row tint
Voided sales SHALL retain their struck-through amount and show an Anulado pill on a completely tinted rounded row without a white border, in preview and breakdown. They SHALL remain excluded from totals.

#### Scenario: Voided audit record
- **WHEN** a voided sale is returned by the API
- **THEN** its entire row is tinted red, its original amount is struck through and no actions appear on that row
