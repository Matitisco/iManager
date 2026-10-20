## Context

The #440 failure is a P2034 from `POST /api/operations/:source` during setup of delete-cancelled-sales, rather than from the cancel endpoint. Both creation and cancellation already use `withSerializableRetry` (five attempts). Receipt allocation uses store counters and a global compatibility sequence. Reproduce contention before changing business semantics.

## Goals / Non-Goals

Resolve the navigation decisions and investigate real PostgreSQL concurrency. Do not alter stock, money or authorization rules. No SMTP work (explicitly deferred), Prisma schema changes or AppContext changes. Hardware validation remains separate.

## Decisions

- Place Proveedores in Finanzas beside Gastos because purchases and supplier obligations belong with financial management. Keep `sectionAllowed('suppliers')` tied to inventory so the move cannot grant or revoke access. Sections, page chips, Más and active states derive from the shared nav definition.
- Use `finanzas/proveedores` as the canonical hash; recognize `stock/proveedores` as a legacy route and preserve queries, replacing browser history rather than adding a redirect entry.
- Show every mobile label below its icon. Equal flexible widths, a 46px button height, and consistent selected/unselected metrics keep the five controls usable at 320px and retain the existing indicator/reduced-motion behavior.
- Keep bounded serializable retries. Verify parallel creation across stores, repeated cancellation of one sale and cancellation of distinct sales sharing a client. Failed attempts must roll back every money/stock/notification effect. If all retries fail, return a safe 409 with a retry instruction rather than an internal 500.
- Reproduction found a second conflict: concurrent cancellation reaches `CashMovement.reversalOf` before updating the sale/trade status, producing P2002 despite Serializable isolation. Acquire a store-filtered `SELECT ... FOR UPDATE` on the Sale or TradeIn before reading cancellation state. The waiting transaction either observes cancellation or retries P2034 before it can duplicate a cash reversal. Do not retry all P2002 failures: duplicate IMEIs remain business errors.
- Only claim the scanner cases actually exercised. Maintain a physical-device checklist for Samsung/Chrome, iPhone/Safari/PWA, rear camera focus/torch and physical readers.

## Risks / Trade-offs

- Small screens constrain text → verify all labels, badges and touch targets at 320/360/390px.
- Moving Proveedores changes its group and selected bottom-bar button → keep previous links working and test inventory-only members.
- A stress test alone cannot identify an historical CI interleaving → distinguish the recorded failure, current reproduction and any mitigation in the QA report.
- Browser emulation does not reproduce optics, lighting or peripheral timing → leave physical results pending.

## Migration Plan

No database migration. Deploy through the normal main push. Revert the commit to roll back; the old supplier hash remains supported.
