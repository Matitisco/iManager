## Why

Issue #84 requests an explicit start and end date in the hi-fi Reports screen. Its preset-only controls cannot select historical or arbitrary reporting windows.

## What Changes

- Add a Personalizado control with inclusive local start/end dates and an explicit apply action.
- Reject missing, invalid or reversed dates while preserving the applied report.
- Use the applied range consistently for totals, comparisons, charts, lists and CSV exports in Ventas, Stock and Canjes.
- Bound chart density and include the entire selected range, including partial months.
- Report stock entries by their creation date and clearly identify their current status; exclude undated records from dated reports.

## Capabilities

### New Capabilities
- `desk-report-period`: arbitrary date windows for hi-fi reporting.

### Modified Capabilities
- None.

## Impact

Frontend Reports, date aggregation helpers, styles and focused tests. Existing AppContext data is reused. No API, AppContext or Prisma schema changes.

## Non-goals

Historical stock reconstruction, saved report preferences, new backend endpoints, changes to the legacy Reports screen or other reporting issues.
