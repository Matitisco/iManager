## Context

The active Reports screen consumes sales, inventory and trade-ins from AppContext. It currently has four presets, chart buckets tied to those presets and inconsistent period filtering in stock lists/exports and undated trade-ins.

## Decisions

- Keep the presets and add an inline date form styled with existing desk tokens. Draft dates do not affect the applied report until submission succeeds. Presets remain immediately applicable.
- Treat date-only values as local calendar dates; timestamps retain their timezone. Use an exclusive next-day boundary so the final selected day is fully included.
- Validate actual calendar dates, including leap days. The previous comparison window contains the same number of calendar days directly before the selected window.
- Generate contiguous chart buckets covering the exact bounds. Use days, weeks or grouped months with at most twelve bars; never label historical buckets as currently in progress.
- Reuse a single filtered data set for aggregation, list rows and export. Category selection further filters lists and CSV. Cancelled sales do not contribute to revenue or its detail rows.
- Stock means equipment entered during the selected range, grouped by current status. Explain this in the screen and indicate undated equipment excluded from the report. Do not present current inventory as a historical snapshot.
- Keep the period selection local to Reports, without changing the shared PeriodKey contract used by Sales.

## Validation

Test local midnight boundaries, leap-day validation, reversed/missing inputs, comparison windows and complete bucket coverage over short and multi-year ranges. Test applying and rejecting dates, all three tabs, category-filtered export and preset switching. Run frontend/backend TypeScript checks without building.
