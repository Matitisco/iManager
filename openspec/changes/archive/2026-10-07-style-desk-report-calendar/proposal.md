## Why

The native date popup in Reports uses operating-system styling and does not match the hi-fi interface shown by the user.

## What Changes

- Replace native date popups with an inline custom calendar using existing desk colors, typography, rounded corners and shadows.
- Preserve manual date entry, local calendar dates, explicit period application and validation.
- Support day, month and year selection, keyboard navigation, Today/Clear actions and dismissal.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `desk-report-period`: styled calendar controls for custom report dates.

## Impact

Reports frontend, a date-picker component, desk CSS and focused tests. No dependencies, backend, AppContext or Prisma changes.

## Non-goals

Replacing date fields elsewhere in the application or changing report calculations.
