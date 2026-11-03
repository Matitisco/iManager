# Seguridad · idor-ventas

Auditoría local del 03/11/2026 sobre `origin/test`. Sin producción, datos reales, build, migraciones ni cambios de `schema.prisma`.

| Severidad | Hallazgo | Estado | OK de Matias |
| --- | --- | --- | --- |
| Media | Bypass del permiso sensible mediante estados de anulación: STAFF podía enviar `ANULADA` a `PATCH /api/sales/:id` o alias equivalentes en el estado del canje (`tradeIn.status` en Operaciones). Persistía con 200/201 aunque cancelar/anular por la ruta dedicada devolvía 403. La UI oculta/clasifica esos registros como anulados y los reportes pueden excluir ventas. Limitado a la tienda del atacante. | Arreglado en el PR de `sec/idor-ventas` contra `test`: mismo permiso sensible para todos los alias reconocidos por Desk, antes de crear/editar/confirmar ventas o canjes. | No: aplica el permiso existente; preserva OWNER, MANAGER y STAFF con acceso sensible explícito. |
| Media | Usuarios con permiso sensible todavía pueden escribir alias históricos como `ANULADA` sin pasar por la cancelación transaccional: estado visual, stock y movimientos pueden quedar inconsistentes. | Pendiente: unificar estados y efectos contables requiere definir compatibilidad histórica y comportamiento de edición/importación. Este PR sólo cierra el bypass de permisos. | **Sí: comportamiento, datos y plata.** |

## Reproducción y validación

- Dos tiendas ficticias y cuentas `qa-sec-1@example.com` a `qa-sec-4@example.com`; PostgreSQL descartable en loopback, puerto privado aleatorio >20000, DB `qa_sec_idor_ventas_test`.
- Requests HTTP reales a Fastify local y matriz con `app.inject`. Diez regresiones del bypass fallaron antes del fix (200/201 en lugar de 403) y pasan después; comprueban que el rechazo no cambia las filas.
- Matriz multi-tienda: listado/detalle/edición/anulación/restauración, clientes asociados, productos, categorías y lotes, vendedores, comisiones/pagos, señas/créditos y cuotas/cuenta corriente. Verifica también consultas/header/body `storeId`, campos internos por mass assignment, autenticación, falta de membresía, permisos de sección y flujos legítimos de STAFF.
- Reportes y fuentes de exportación CSV conservan datos de la membresía; los CSV de ventas/reportes se generan en el frontend a partir de esos listados/respuestas. #691 permanece intacto, incluido acceso financiero de STAFF.
- TypeScript frontend/backend, 44 unitarias y 119 integraciones relacionadas aprobadas (24 tests nuevos). La tanda afectada por agotamiento de inodos de la máquina compartida se repitió correctamente. No se ejecutó la suite completa localmente.

## Límites y defensa pendiente

No se confirmó IDOR entre tiendas en las rutas probadas. Hay escrituras por `id` e includes que dependen de una comprobación previa con `storeId` y de relaciones creadas por servicios que validan pertenencia. No se auditó ni reparó información histórica de producción. Las FKs actuales no garantizan pertenencia conjunta por tienda frente a vínculos corruptos creados fuera de estas APIs; reforzarlas requiere schema/migración, prohibidos en esta tarea, y **OK de Matias** para datos/schema. No se restringieron precios editables ni asignación manual de vendedor: son flujos legítimos existentes.
