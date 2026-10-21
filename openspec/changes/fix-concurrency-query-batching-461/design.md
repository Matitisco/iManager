## Context
The implementation follows the supplied eight-part plan, preserving current validation responses and import partial success. The local PostgreSQL test database is the only database used. The OpenSpec executable is unavailable; artifacts use the repository spec-driven format directly.

## Decisions
- Use existing withSerializableRetry for read/validate/write transactions; put dependent reads inside every retry. Explicit row locks precede eligibility/status checks, with inventory locks acquired in sorted order.
- Use explicitly supplied client patch fields, current transaction rows for audit differences, and atomic increments for additive totals. The client form sends only fields changed from its initial draft; unchanged balances/totals and contact fields must not be replayed after concurrent updates. Preserve explicit clearing and currency when the balance is edited.
- Commit stock changes, per-item audits and count resolution together. Share transaction-aware batched archival logic with single-item archival.
- Use a transaction-scoped advisory lock shared by catalog initialization and saving; no new uniqueness constraints.
- Read commission members, accruals/payments and assignment inputs in batches; project each historical cutoff using the existing pure ledger rules.
- Guard reads by scope, generation and ticket. Invalidate before mutations. Track overlapping mutations per record and reconcile authoritative data without losing independent record changes.

## Risks
Serializable retries must contain no externally visible side effects. Preserve cash/operation locks and existing lock order; retry serialization/deadlocks. Batch only consistency-compatible reads; retain per-import-row transactions. Scope guards cover logout and store changes, and errors remain visible to the caller.

## Validation
Reproduce defects with controlled interleavings against local PostgreSQL and deferred frontend promises. Query budgets exclude fixtures and capture no parameters. Run frontend tests, backend unit/integration tests and both TypeScript checks, without builds or local deployment. Document exact results and any environmental limitations.
