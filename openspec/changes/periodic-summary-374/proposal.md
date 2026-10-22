## Why
Issue #374 requires an in-app business audit summary of completed calendar periods in Reportes.

## What Changes
- Add Resumen periódico beside the existing Análisis tabs, with closed fortnight/month selection and complete breakdowns.
- Add a tenant-scoped read-only Reports endpoint using existing Sales, Returns and StockCount records.
- Preserve report/module permissions and shared currency conversion. Exclude voided sales from amounts.

## Capabilities
### New Capabilities
- `periodic-summary`: calendar period audit summary.

## Impact
Reports frontend, shared title navigation slot, reports API and tests. No Prisma schema changes.

## Non-goals
Email, scheduler configuration, production database writes, schema changes and changing existing report calculations.
