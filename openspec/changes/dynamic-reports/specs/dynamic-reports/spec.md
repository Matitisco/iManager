## ADDED Requirements

### Requirement: Reports screen uses aggregated backend data
The system SHALL render the Reports screen using aggregated PostgreSQL data for the authenticated store and the selected date range, without falling back to demo values.

#### Scenario: Reports overview loads successfully
- **WHEN** an authenticated user with a resolved store opens the Reports screen and the backend is available
- **THEN** the frontend requests an aggregated reports payload for that store and renders KPIs, charts and operational summaries from the response

#### Scenario: Backend is not ready for reports
- **WHEN** the authenticated user opens the Reports screen while the backend connection is offline, unconfigured or the business context is unresolved
- **THEN** the screen shows a visible warning/error state and MUST NOT render fake metrics or charts

### Requirement: Reports support visible range filtering
The system SHALL allow the user to switch between predefined date ranges and refresh the report payload for the selected window.

#### Scenario: User changes the report range
- **WHEN** the user selects another preset range in the Reports screen
- **THEN** the frontend requests a new aggregated payload for that range and updates the cards and charts accordingly

### Requirement: Reports can be exported from the visible summary
The system SHALL allow the user to export the currently visible report summary without changing the selected range.

#### Scenario: Export current report
- **WHEN** the user clicks the export action in the Reports screen after data has loaded
- **THEN** the frontend downloads a file containing the same summary sections shown on screen for the active range
