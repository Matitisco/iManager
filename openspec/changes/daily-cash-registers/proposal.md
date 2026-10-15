## Why
Issue #307 necesita ingresos/egresos y arqueos reales por moneda y medio, integrados al cobro y stock existentes.

## What Changes
- Cajas ARS/USD, Efectivo/Transferencia, saldo inicial, ajustes sin resultado, archivo y predeterminada por moneda/medio.
- Movimientos manuales categorizados, transferencias/conversiones atómicas con cotización persistida y anulación compensatoria.
- Integración transaccional con ventas, cobros, señas y anticipos/cobros de reparación existentes. Sin backfill de importaciones históricas.
- Sesiones diarias independientes, conteo a ciegas por denominaciones o total bancario, nota de diferencia, aprobación/reconteo del dueño.
- Permiso de saldo separado de acceso a Cajas; mobile iPhone y desktop con componentes actuales. Sin exportación.

## Capabilities
### New Capabilities
- `cash-registers`: cajas, ledger, sesiones y arqueo.
### Modified Capabilities

## Impact
Prisma aditivo, módulo cash REST, integración de cobros existentes, AppContext y navegación. Proveedores aún no tienen ficha: egreso manual categorizado en v1. Sólo bases locales de pruebas; commits locales, sin push.
