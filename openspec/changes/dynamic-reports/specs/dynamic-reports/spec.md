## ADDED Requirements

### Requirement: Reports screen uses configurable widgets with backend data
The system SHALL render the Reports screen using aggregated PostgreSQL data for the authenticated store and SHALL allow the user to choose which report widgets are visible and in which order they appear.

#### Scenario: Reports overview loads with visible widgets
- **WHEN** an authenticated user with a resolved store opens the Reports screen and the backend is available
- **THEN** the frontend requests an aggregated reports payload for that store and renders only the widgets configured as visible

#### Scenario: User personalizes the widget layout
- **WHEN** the user opens the personalization flow and changes widget visibility or order
- **THEN** the Reports screen updates the visible widgets accordingly and preserves that layout for the same user and store in the current browser

#### Scenario: All widgets are hidden
- **WHEN** the user hides every widget in the Reports screen
- **THEN** the screen shows an explicit empty state instead of rendering demo content

### Requirement: Reports support preset and custom date ranges
The system SHALL allow the user to switch between predefined date ranges or apply a custom start/end date range for the reports overview.

#### Scenario: User changes to a preset range
- **WHEN** the user selects another preset range in the Reports screen
- **THEN** the frontend requests a new aggregated payload for that range and updates the widgets accordingly

#### Scenario: User applies a custom range
- **WHEN** the user enters a valid custom start date and end date and applies the filter
- **THEN** the frontend requests the reports overview using `rangeKey=custom` and the explicit date boundaries

#### Scenario: User enters an invalid custom range
- **WHEN** the user tries to apply a custom range with missing or inverted dates
- **THEN** the screen shows a visible validation error and does not replace the current report with demo content

### Requirement: Reports expose inventory value and top products from real data
The system SHALL include real inventory valuation and top product rankings in the aggregated report payload for the selected range.

#### Scenario: Inventory valuation is available
- **WHEN** the report payload is returned for a store
- **THEN** it includes the cost value and potential sale value of the available inventory

#### Scenario: Top products exclude pending sales
- **WHEN** the report payload ranks products for the visible range
- **THEN** only completed sales contribute to top product units, revenue and share

### Requirement: Reports export the visible summary only
The system SHALL allow the user to export the currently visible report summary without changing the selected range.

#### Scenario: Export current visible layout
- **WHEN** the user clicks the export action after data has loaded
- **THEN** the frontend downloads a file containing the sections for the currently visible widgets plus the active date range metadata
