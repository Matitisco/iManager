## Context
See proposal.md. Reports currently consumes global module lists; settled requests are indistinguishable from successful data. Existing concurrency guards use scope, generation and read tickets.

## Goals / Non-Goals
Use pure report-specific helpers and additive metadata. Preserve shared financial functions, permissions, service contracts and excluded screens. No schema or backend production changes.

## Decisions
- Calendar boundaries use local date constructors and exclusive next-day ends; commission keys use store timezone. Independent report presets avoid changing other screens.
- Typed deltas carry direction, magnitude, unit, comparison and tone. Null conversion propagates in both cohorts.
- Stock snapshot uses all authorized inventory; breakdown uses dated entry cohort; sale classification uses the full inventory lookup.
- Availability travels through AppContext, keyed to the existing scope and accepted read tickets. Cache hydration does not establish request success. Retry uses existing refresh without clearing records.
- Commission monthly responses and previous-month comparison are scoped independently; signed parts render as values, not proportions.
- Scoped Reports CSS reconciles mobile wrapping; two independently scrollable rows retain reachable controls.

## Risks / Trade-offs
Missing historical events → unavailable durations with measured counts. No historical FX reconstruction → truthful store-rate conversion copy. Illustrative wireframe values → internally consistent fixtures. Production reproduction lacks authenticated session → record read-only version evidence and runtime simulation separately.

## Migration Plan
Frontend-only rollout, no data migration. Reverting affected frontend files restores prior behavior. No deploy in this worktree.
