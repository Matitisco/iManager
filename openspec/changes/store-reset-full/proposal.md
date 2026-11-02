## Why
El reset actual conserva clientes y separa su deuda de ventas; los saldos en otra moneda sin cotización histórica bloquean el preview con 409. Se necesita vaciar también clientes y reparaciones sin convertir saldos.

## What Changes
Agregar `scope: "full"` opcional a POST /admin/store-reset. Sin scope se mantiene el alcance actual. Full elimina clientes, cuenta corriente, señas, reparaciones y dependencias, todos los canjes/devoluciones y sus movimientos de caja. Conserva identidad de tienda, cuentas, configuración, catálogos, billing y auditoría previa.

## Impact
Backend, integraciones con PostgreSQL local ficticio y contrato administrativo. Sin schema/UI ni acceso a datos reales. Entrega desde feat/store-reset-full en PR contra test, sin merge ni deploy.
