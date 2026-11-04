# Accesorios por cantidad · #760

Variante A aprobada: Stock → Accesorios, tarjetas, lista y buscador; alta con segmento Celular/Accesorio. Los tipos son Templado, Funda, Cargador, Cable, Auriculares y Otro. Compatibilidad opcional. «Poco stock» significa menos de cinco unidades, incluido cero; la constante y la validación están compartidas entre cliente y servidor. Se omite carga en serie para mantener el alcance acotado.

## Datos y operaciones

Migración **20261104120000_inventory_accessories**: únicamente tres ADD COLUMN en InventoryItem. `kind` es VARCHAR(20) con default constante DEVICE; `accessoryType` y `compatibleWith` son nullable. PostgreSQL 11+ almacena un default constante en metadatos al agregar la columna, sin reescribir las filas. Sin UPDATE, backfill, DROP, RENAME, cambios de tipo ni modificación de registros existentes. No se ejecuta localmente contra ninguna base de negocio.

Accesorios reutilizan model, cantidad, cost y price. Dinero persistido como Decimal, valuación por cantidad calculada con Decimal y conversión/presentación con los helpers existentes. Los lectores anteriores aceptan productos sin kind como celulares. La API lista DEVICE por defecto; AppContext solicita ALL explícitamente. El tipo no se cambia después del alta para conservar las asociaciones históricas.

Ventas ofrece celulares y accesorios con stock disponible. Reutiliza requestKey, bloqueo de inventario, transacción Serializable con retry, validación de sobreventa, descuento y restitución de unidades existentes. Las devoluciones parciales que separan un lote conservan kind, tipo y compatibilidad. «Vendidos este mes» suma cantidades de ventas completadas o pendientes no anuladas según el mes de la zona horaria de la tienda, sin exponer importes ni clientes al permiso Stock.

## Lectores auditados

| Lector | Decisión |
| --- | --- |
| Equipos, incluidas listas archivadas y autocompletado de modelos | DEVICE |
| Dashboard, reportes de equipos, resumen periódico y sus devoluciones compensadas | Excluir accesorios; conservar ventas históricas sin producto vinculado |
| Control de stock, catálogos públicos y reglas de membresía | DEVICE |
| Import, sugerencias/modelos y herramientas administrativas de duplicados | DEVICE; no se reclasifica ningún accesorio viejo |
| Proveedores, compras y fallas que cuentan equipos | DEVICE, conservando las asociaciones de compras del inventario |
| Reservas de equipos por seña | Solo celulares; se evita reservar involuntariamente un lote entero de accesorios |
| Ventas, devoluciones, clientes/cuentas, caja, comisiones, garantías, historial, borrado/restauración y reset administrativo | Mantener los flujos generales con ambos tipos y sus efectos transaccionales |
| Actividad administrativa | El contador de equipos excluye accesorios; la actividad comercial y auditoría conservan todos los eventos |

Se reutilizan los permisos de Inventario. Costos, valuación y escritura usan canSeeFinancials; #691 se conserva para STAFF. El backend ignora costos enviados sin permiso y los oculta, junto con costValue, en las respuestas. El frontend no los envía y limpia ambos al perder permisos.

## Validación

Sin build, instalaciones, Postgres local, Playwright local, capturas ni acceso a producción. TypeScript frontend/backend y E2E; Vitest únicamente en archivos relacionados, con un máximo de dos workers. Las integraciones nuevas cubren alta, validación, segregación de listados/IDs/paginación, aislamiento de tienda, stock/caja transaccionales, requestKey, sobreventa concurrente, anulación, devolución parcial, permisos, archivo y reportes. E2E escrito para 1440/390 y claro/oscuro; PostgreSQL y navegador se ejecutan en CI.
