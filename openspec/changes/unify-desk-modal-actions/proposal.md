## Why

Issue #447 extends the usable modal pattern from #286/#439. On main ba2d918,
Escape closes Nuevo gasto while persistence is pending, focus remains in the
background, and independent Escape handlers can dismiss nested layers together.

## What Changes

- A small shared interaction hook for Sheet/Dialog, plus adapters for existing
  nested selectors and state editors. Contain/restore focus and dismiss only
  the top layer; busy blocks user dismissal.
- A shared Sheet header/body/footer frame and state-specific action hierarchy
  for commissions, expenses, sales, trade-ins, equipment, clients and repairs.
- Preserve the guarantees of compact-sale-detail and #439; one visible primary
  action per state, with every permitted secondary action discoverable.

## Non-goals

No backend, AppContext, financial logic, permissions, dependencies,
Prisma/schema changes, camera changes, production operations or build. No issue
closure, merge, or deployed-QA claim.
