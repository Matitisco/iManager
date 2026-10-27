## Approach
Keep selection local to each screen and scoped to store/user. Derive eligible selection from the complete filtered list, prune rows leaving the filter, retain selection across pages and support Shift+click ranges. Header select-all uses the filtered list rather than the page slice.

Desktop row clicks keep opening the record detail even when selection is active. Only the checkbox and its label toggle selection and stop propagation to the row. The input keeps its record-specific accessible label; the selection cell has the generic name "Selección" so data cells remain uniquely discoverable by their record names. Mobile cards keep toggling selection on tap while selection is active.

Use a shared action bar and confirmation dialog. CSV contains only explicit displayed fields and currencies, never hidden cost data. Reuse the report CSV download helper.

Delete inventory/clients through existing AppContext methods; cancel only integrated or trade-backed sales through updateSale(CANCELADA), which dispatches integrated operations appropriately. Historical sales without an operation remain exportable. Cancel only operation-backed, non-cancelled trade-ins through cancelTradeOperation. Historical trade-ins remain exportable. Backend endpoints already enforce section access, sensitiveAccess, store ownership and audit; cancellation transactions restore stock/balances. No schema or endpoint changes.

Run sequentially through every item despite per-item business or network failures. Remove only successful rows from selection; keep failed rows selected and unlock when the sequence ends. Announce attempted/total progress through a polite status region. If all succeed, close and toast as before. Otherwise show a Resultado sheet with success/failure counts, native Ver detalle disclosure, a scrollable list (220px maximum) of failed record names and normalized reasons, and one primary Listo footer button. Use archived/voided participles configured by each screen, defaulting to processed. Preserve client credit-balance recovery for the first matching failed row. Prevent duplicate submission and dismissal while working. Stop further requests and state updates on unmount/store/user switch.

Mobile long press selects instead of opening the row menu. Keep the explicit menu available outside selection mode. Checkboxes are siblings of card buttons, avoiding nested interactive controls. The bottom bar covers the navigation, uses safe-area padding and touch targets of at least 44px.

## Validation
Vitest selection/action/screen/export regressions; backend integration tests for reused sensitive endpoints, audit, store isolation and cancellation. Required lint/build/full frontend/backend unit runs. Playwright with existing local seed/auth and iPhone 13 WebKit, screenshots inspected at the requested paths.
