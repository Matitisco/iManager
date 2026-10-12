## Why
Issue #285 requests selection and safe bulk actions in Inventario, Ventas, Canjes and Clientes in the current desk UI, including iPhone.

## What Changes
- Shared row selection, filtered select-all across pagination, selection count and mobile long press/bottom bar.
- CSV export in all four tables; delete inventory/clients; cancel sales and operation-backed trade-ins with confirmation and existing sensitive permissions.
- Reuse per-item AppContext operations and server validation/audit; disclose partial results and retain pending selection.

## Non-goals
No new bulk endpoints, Prisma changes, commission changes, invented archive/status semantics or global batch atomicity. Each request retains the existing operation's transaction and rules.

## Impact
Four desk screens, shared press targets, CSV utility and tests. The explicit issue instruction authorizes implementation, build, commit on the current branch and no push.
