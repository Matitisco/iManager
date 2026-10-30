## ADDED Requirements

### Requirement: Every inventory data column has a filter
The system SHALL offer a funnel in every data header, preserving the existing presentation, and the same criteria in the mobile filter sheet.

#### Scenario: Typed criteria compose
- **WHEN** a user selects entry dates, text search/presence, numeric bounds or multiple categorical values
- **THEN** criteria combine with all other filters and search before pagination, and active filters remain visible and can be cleared individually or together

#### Scenario: Cost permissions and quantity presentation
- **WHEN** a member cannot see financials
- **THEN** cost filtering is hidden along with cost data, and quantity cell width and alignment remain unchanged

#### Scenario: Inclusive date and number ranges
- **WHEN** a user enters either or both bounds
- **THEN** matching includes the boundary values and the entire final calendar day, and missing values do not match an active range

#### Scenario: Mobile draft
- **WHEN** a user edits or clears criteria in the mobile sheet
- **THEN** only Aplicar filtros commits changes; closing the sheet preserves the current applied criteria
