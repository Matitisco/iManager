## Context
Postgres es fuente de verdad. Sales/operations cambian stock y saldos en transacciones. SaleTender conserva pagos mixtos en moneda original; ClientPayment conserva cuenta corriente. Dólar blue ya existe.

## Goals / Non-Goals
Ledger durable por caja, no duplicar cobros por aplicación de señas. Conservar historia de anulaciones y conteos. Sin exportación ni nueva ficha de proveedores ni integración contable completa con Estado de Resultados en v1.

## Decisions
CashRegister + CashSession + CashMovement + CashCount; importes Decimal(12,2), ids de origen sin FK para conservar historia tras bajas. Bloqueo de tienda transaccional común para movimientos y cierres; sesiones únicas por caja/día. Idempotencia de comandos manuales y compensación única por movimiento. La primera caja de cada moneda/medio es predeterminada; dueño puede reasignar. Si se habilitaron cajas, un cobro real sin caja compatible o sesión abierta falla visiblemente y revierte la operación completa. Tiendas sin cajas mantienen comportamiento actual. Importaciones no impactan caja.

Conteo congela esperado y contado, pausa movimientos; diferencia requiere nota. Dueño aprueba (saldo pasa a contado vía ajuste de arqueo que no es ingreso/gasto) o solicita otro conteo (conserva intentos y no reabre movimientos). Día nuevo requiere aprobación del anterior y no se abre dos veces en el mismo día. Ajustes manuales necesitan sesión abierta y explicación. No se permite archivar con sesión pendiente.

Permisos: acceso Cajas y permiso separado cashBalances en sections; OWNER ve y administra todo, otros registran y cuentan con acceso Cajas pero sólo leen saldo/historial con permiso explícito. Conteos anteriores no se filtran al formulario de reconteo. Historial se pagina y filtra por fechas inclusivas en timezone de tienda/categoría, incluida sin categoría.

## Risks / Trade-offs
En v1 cobros automáticos van a predeterminada, medios distintos de efectivo/transferencia exigen decisión futura; falla explícita al tener cajas activas. Anticipo legacy de reparación no tiene medio: se registra como efectivo y se indica en el formulario. Corrección financiera de ventas con caja vinculada se realiza anulando y recargando; categoría se puede cambiar sin mover plata. Proveedores se cargan manualmente, categoría obligatoria. Cotización blue precargada editable, guardada en ambas patas de conversión; jamás convierte saldos existentes.

## Migration Plan
Crear tablas e índices/FKs nuevos con SQL aditivo generado desde schema previo. Aplicar con `prisma db push` sin aceptar pérdida de datos ni agregar unicidades a tablas anteriores. Verificado en PostgreSQL local sobre el esquema de `origin/main` (`41a91ad`) con una tienda y dos equipos previos que comparten `reservedDepositId`: se conservan registros e importes y no se genera backfill. Sin producción.

## Open Questions
Ficha de proveedores/pagos automáticos; tarjeta/otros medios; elección de caja por cobro cuando se necesitan varias del mismo medio; integración de categorías al Estado de Resultados.
