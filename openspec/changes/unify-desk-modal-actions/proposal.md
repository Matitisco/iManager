## Why

Issue #447 extends the usable modal pattern from #286/#439. On main ba2d918,
Escape closes Nuevo gasto while persistence is pending, focus remains in the
background, and independent Escape handlers can dismiss nested layers together.

## What Changes

- First delivery: a small shared interaction hook for Sheet/Dialog, plus adapters
  for the existing nested selector and state editor. Contain/restore focus and
  dismiss only the top layer; busy blocks user dismissal.
- Wire Nuevo gasto's busy state to Sheet to cover the reproduced regression.
- Define the contract and focused tests for the later Luna implementation.
- Later delivery: shared header/body/footer layout and state-specific action
  hierarchy for commissions, expenses, sales, trade-ins, equipment, clients and
  repairs. Preserve the guarantees of compact-sale-detail and #439.

## Non-goals

This first delivery does not migrate the seven flows or change their visual
hierarchy. No backend, AppContext, financial logic, permissions, dependencies,
Prisma/schema changes, camera changes, production operations or build. No issue
closure, merge, or deployed-QA claim.
