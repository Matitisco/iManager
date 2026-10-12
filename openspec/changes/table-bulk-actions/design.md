## Approach
Keep selection local to each screen and scoped to store/user. Derive eligible selection from the complete filtered list, prune rows leaving the filter, retain selection across pages and support Shift+click ranges. Header select-all uses the filtered list rather than the page slice.

Use a shared action bar and confirmation dialog. CSV contains only explicit displayed fields and currencies, never hidden cost data. Reuse the report CSV download helper.

Delete inventory/clients through existing AppContext methods; cancel only integrated or trade-backed sales through updateSale(CANCELADA), which dispatches integrated operations appropriately. Historical sales without an operation remain exportable. Cancel only operation-backed, non-cancelled trade-ins through cancelTradeOperation. Historical trade-ins remain exportable. Backend endpoints already enforce section access, sensitiveAccess, store ownership and audit; cancellation transactions restore stock/balances. No schema or endpoint changes.

Run sequentially, stop on first failure, remove successful rows from selection and keep failed/unattempted rows with visible counts and error. Prevent duplicate submission and dismissal while working. Stop further requests on unmount/store/user switch.

Mobile long press selects instead of opening the row menu. Keep the explicit menu available outside selection mode. Checkboxes are siblings of card buttons, avoiding nested interactive controls. The bottom bar covers the navigation, uses safe-area padding and touch targets of at least 44px.

## Validation
Vitest selection/action/screen/export regressions; backend integration tests for reused sensitive endpoints, audit, store isolation and cancellation. Required lint/build/full frontend/backend unit runs. Playwright with existing local seed/auth and iPhone 13 WebKit, screenshots inspected at the requested paths.
