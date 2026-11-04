## Decisiones
- Schema estricto con scope full opcional. Mantener guards OWNER/email, nombre e ID, autorización platform admin, transacción Serializable y dryRun con rollback completo.
- Selección congelada por tienda para full, con hijos antes que padres. Agregar RepairStatusEvent, RepairOrder y Client al mapa willDelete; eliminar todas las filas operativas de ese alcance, incluidas archivadas e independientes de ventas.
- Full omite clientAdjustments y la guarda de cobros/señas compartidos con reparaciones: ambas entidades se eliminan. No consultar ni convertir cotizaciones.
- Eliminar movimientos de las fuentes operativas incluso con sourceId huérfano, movimientos automáticos históricos sin fuente identificable y reversiones recursivas. Conservar movimientos manuales y transferencias independientes. Descontar el neto atribuible a cada caja en su moneda; ante movimientos sin caja atribuible o moneda incompatible, poner en cero las cajas afectadas (todas si faltan metadatos). Conservar definiciones, sesiones y arqueos históricos de caja.
- Mantener verificación de fingerprints de filas preservadas y otras tiendas. Apply exige mapa completo exacto de willDelete del scope solicitado. Auditoría store.reset incluye scope explícito (sales-inventory por defecto, full cuando se solicita) y cantidad de cajas llevadas a cero en full. Sin reiniciar numeración.

## Validación
Regresión con cliente USD en tienda ARS sin tasa histórica, borrado completo y aislamiento de otra tienda; snapshots de todos los modelos. Verificar rollback preview/errores, guards/auth, conteos frescos, movimientos/reversiones y fallback de caja, conservación de configuración/billing/auditoría y comportamiento anterior. TypeScript frontend/backend y tests backend, sin build.
