# Tasks: integrated desk operations

- [x] Add Prisma operation links, pending registration state, notification and per-user read models.
- [x] Add a tracked serializable transaction helper and transaction-scoped notification writer contract.
- [x] Implement the store-scoped operations service with create, draft, confirm, edit, cancel, idempotency, stock/client accounting and summaries.
- [x] Add `/api/operations/:source` routes, source-section authorization, minimal options lookup, and app registration.
- [x] Route legacy manual sale writes through the shared operation service; block legacy independent writes on linked sales/trade-ins; mark manual inventory `VENDIDO` updates pending registration while keeping imports unchanged.
- [x] Add integration coverage for draft isolation, confirmation/retry, notification links, client balances, cancellation, manual sold registration, duplicate prevention, and section permissions.
- [ ] Frontend integration remains in a separate follow-up; do not modify `src/` here.
