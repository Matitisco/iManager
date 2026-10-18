## Decisions
Las ventas CANCELADA siguen siendo de solo lectura y la API mantiene el 409 existente. El formulario protege estados obsoletos con aviso ferr y guardado deshabilitado. Un ref y efecto desplazan el error de run a la vista. Se conserva commitGroup para mantener importes y monedas originales; la protección de señas compara importes a centavos. La diferencia del canje conserva el importe antes de señas; solo la deuda deduce las señas aplicadas.

## Validation
Vitest frontend, integración de operaciones/comisiones, Playwright Chromium desktop y 390 px. TypeScript frontend/backend, suites completas y build solicitado. Solo PostgreSQL local imanager_test_vendedor. Sin commit ni push.
