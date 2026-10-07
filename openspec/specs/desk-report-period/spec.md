# desk-report-period Specification

## Purpose
Define inclusive custom date windows and consistent dated data across hi-fi report totals, charts, detail lists and CSV exports.
## Requirements
### Requirement: Apply a custom inclusive reporting period
The Reports screen SHALL allow a user to enter a start and end date and explicitly apply the inclusive local calendar range while retaining the existing presets.

#### Scenario: Apply a historical range
- **WHEN** the user submits valid start and end dates
- **THEN** the screen identifies the applied dates and calculates the report from local midnight on the first day through the end of the last day

#### Scenario: Reject an invalid draft
- **WHEN** either date is missing, invalid or the start is after the end
- **THEN** the screen displays an actionable validation error and retains the previously applied report

#### Scenario: Return to a preset
- **WHEN** the user selects a preset after applying custom dates
- **THEN** the preset immediately determines the report bounds and hides the custom date form

### Requirement: Consistent dated report data
The screen SHALL calculate totals, charts, detail lists and CSV exports from the same applied period for Ventas, Stock and Canjes. Cancelled sales and records without a usable reporting date SHALL be excluded. A selected category SHALL further restrict detail rows and export.

#### Scenario: Include the end date
- **WHEN** a record occurs late on the selected end date or is stored as a date-only value on that day
- **THEN** it is included, while records on the following day are excluded

#### Scenario: Report stock entries
- **WHEN** the user views Stock
- **THEN** the report contains equipment created in the range, identifies status as current and explains exclusion of equipment without an entry date

#### Scenario: Export filtered details
- **WHEN** the user exports a tab with an applied date range and category filter
- **THEN** the CSV contains the same detail records as the visible list

### Requirement: Cover the full range in bounded chart buckets
Evolution charts SHALL use contiguous non-overlapping buckets spanning the exact applied range with at most twelve bars. Revenue comparisons SHALL use the preceding equal-length calendar window.

#### Scenario: Select a long range
- **WHEN** a range spans partial months or multiple years
- **THEN** every included record contributes to one chart bucket and the chart remains bounded to twelve bars

#### Scenario: Select a historical range
- **WHEN** the final bucket is entirely in the past
- **THEN** its tooltip identifies the bucket without claiming it is currently in progress
