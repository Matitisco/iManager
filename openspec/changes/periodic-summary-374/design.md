## Context
The approved v3b layout has three bentos with previews and complete modal breakdowns. Regenerated desktop/mobile references are saved outside the repository at /workspace/imanager-local/shots/374/wireframe.png and wireframe-modal.png.

## Decisions
- Read-only GET /api/reports/periodic-summary; authenticate, resolve membership and require reports. Sales and returns require sales access; physical count results require the existing count-management permission, avoiding disclosure of blind counts to staff.
- Latest periods mean completed calendar halves (1–15, 16–month end) and months in the store timezone. Offer the previous twelve months and twenty-four halves, with validated closed-period identifiers.
- Sales use their stored business date, preserving cancelled rows but excluding CANCELADA, ANULADA, cancelledAt and voidedAt from totals. Pending sales retain existing Reportes amount semantics.
- Returns use the first commercial resolution event (RESUELTO/EN_PROVEEDOR), falling back to resolved/opening date for historical records. Refunds and credit notes already settled during an ongoing supplier RMA contribute money in that original period; unsettled RMA contributes zero. Deleted/voided claims are excluded.
- Closed stock snapshots supply discrepancies. Count distinct IMEIs across the period, keeping the most recent discrepancy for each. Include missing, surplus and physically scanned sold devices, excluding devices legitimately sold during counting. Never compare with current stock.
- API returns source currency totals; useMoney applies the same display conversion and unavailable-rate behavior as Reportes.
- Screen-local read-only query state follows the existing commission report pattern; no duplicate CRUD state or AppContext changes. Key results by tenant, user, permissions and period, discard stale responses, show errors/retry and loading skeletons.
- Reuse DeskSelect (desktop popup / mobile sheet) and Sheet for complete breakdowns. Keep all three cards on desktop and stack at 390px. Keep the established shell and typography; omit decorative thumbnails from the generated reference.
- Apply v3b: no date range below the period chips, no helper captions in empty cards and no cancellation caption. Voided rows retain a struck-through amount and date. Keep physical-count metadata only when differences exist.
- Every Ver todas button opens a shared Sheet modal (centered on desktop, bottom sheet on mobile) with all records, scrollable content, close button, Escape, backdrop dismissal, focus trapping and focus restoration. No screen navigation or modal subtitle.

## Risks
Historical summaries reflect current void/resolution state; they are not immutable accounting exports. No scheduler is invoked or modified.
