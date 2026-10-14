## Context
Se reutilizan analyzeTextImport (#338), importación revisada de inventario y las invitaciones actuales.

## Decisions
- Solo el alta de una tienda escribe onboardingStartedAt; las existentes conservan null. onboardingStage persiste video → invite → stock; onboardingCompletedAt permite reanudar tras recargar.
- Primeros pasos obtiene avances reales en backend, por tienda y permisos; solo pendientes visibles y progreso sobre todos los pasos; descarte, video visto e instalación se guardan por membresía.
- El análisis usa el observador de chunks existente, transportado como NDJSON por el mismo endpoint de #338 con opt-in, cancelación y cuota compartida. No persiste.
- La pantalla de resultado exige confirmación, suma cantidades y proyecta ambas monedas con cotización real. Las dudas se guardan en customFields y se muestran en inventario.
- Las muestras se crean en una transacción con advisory lock y sampleBatchId de servidor; el DELETE filtra por tienda y esa marca.
- Ayuda es accesible desde Más y Cuenta; video montado solo al abrir, preload none, poster local y URL configurable.

## Validation
Vitest frontend/backend, integración PostgreSQL aislada, Playwright desktop e iPhone con endpoint de análisis simulado, typecheck y builds solicitados.
