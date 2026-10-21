## Implementation

- [x] Backend: reproduce and serialize collections and account movements, including concurrent cancellation and installments
- [x] Backend: patch clients using transaction-current fields; protect archival eligibility
- [x] Backend: re-read locked import stock, atomically update client totals and commit caches only on success
- [x] Backend: atomically resolve stock counts with transaction-aware batched archival and query budgets
- [x] Backend: validate repair budget/permissions on every retry and serialize status history
- [x] Backend: coordinate catalog initialization/save and guard expense/supplier archive transitions
- [x] Backend: batch monthly commission history and bulk seller assignment with equivalence/query-budget tests
- [x] Frontend: guard initial loads/refreshes by scope, generation and ticket in store-records
- [x] Frontend: guard AppContext mutations and reconcile overlapping optimistic product writes per record
- [x] Frontend: send client form patches from initial draft changes, preserving explicit clearing and edited balance currency; verify at 390/1440 px
- [x] Validation: run complete frontend/backend unit/integration suites and both TypeScript checks; document results
