## Decisions
Reutilizar indexProblems y su consulta de reclamos vigentes/reparaciones abiertas; retirar solo EN_REVISION como señal independiente. Reutilizar filas kv y seeCosts del detalle, con useMoney para moneda. Mantener privacidad data-ph-mask y representar costos ausentes con —.

## Validation
Tests de señales independientes y combinadas, texto singular/plural, IMEI en ambos layouts, costos ARS/USD, cero, ausencia y permisos. Lint frontend/backend, build solicitado y capturas 1440/390.
