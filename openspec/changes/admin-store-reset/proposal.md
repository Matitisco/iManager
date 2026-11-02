## Why
Matias pidió poder vaciar ventas e inventario de una tienda también en producción, con guardas explícitas por request.

## What Changes
POST /admin/store-reset exclusivo para platform admins. Resolver OWNER activo por storeEmail y validar expectStoreName/expectStoreId. Eliminar bloqueo por entorno y allowlist. dryRun ejecuta y revierte la transacción Serializable completa. Aplicar requiere expect idéntico al mapa willDelete del preview, incluidas ventas e inventario.

## Scope
Borrar ventas, stock e historial operativo de inventario y dependencias identificables de ventas (cobros, cuotas, canjes, devoluciones, créditos, comisiones devengadas y movimientos de caja). Conservar clientes, usuarios, miembros, tienda, configuración, billing, auditoría previa y módulos independientes. Corregir agregados de clientes y descontar de caja solamente los movimientos eliminados. Conservar numeración para no reutilizar comprobantes auditados.

## Impact
Backend admin, integración y documentación. Sin UI, schema, dependencias ni ejecución contra datos reales. Rama feat/admin-store-reset y PR nuevo contra test; no main ni deploy.
