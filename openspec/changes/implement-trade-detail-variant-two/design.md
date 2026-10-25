## Decisions
Integrar la composición elegida directamente en TradeDetail. Usar Sheet, tracking-summary, dhero, RecordHistoryButton, Segs, Pill y el footer existente. CSS acotado a trade-detail-sheet con prefijo cjd para tarjetas, espaciado y truncado. Los datos siguen desde AppContext y fetchTradeOperation, con displayedSaleDue sin alterar.

## Validation
TypeScript frontend/backend, tests relacionados con máximo dos workers y QA del servidor local con PostgreSQL ficticio a 1440×900 @1x y 390×844 @2x. Verificar historial, estado, acciones, scroll interno y pie fijo. Sin build.
