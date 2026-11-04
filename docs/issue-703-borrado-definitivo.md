# Issue #703: borrado definitivo exclusivo del dueño

La baja lógica conserva los endpoints, permisos y efectos anteriores. El borrado definitivo usa rutas separadas, requiere el rol OWNER de la tienda actual y exige una baja lógica previa.

| Entidad | Endpoint nuevo | Baja previa requerida |
| --- | --- | --- |
| Ventas | `DELETE /api/sales/:id/permanent` | `voidedAt` o estado cancelado/anulado, incluidos aliases históricos |
| Equipos | `DELETE /api/inventory/:id/permanent` | `archivedAt` |
| Clientes | `DELETE /api/clients/:id/permanent` | `archivedAt` |
| Canjes | `DELETE /api/trade-ins/:id/permanent` | `voidedAt`, `confirmationStatus=CANCELLED` o estado cancelado/anulado |
| Reparaciones | `DELETE /api/repairs/:id/permanent` | `archivedAt` |

Respuesta exitosa: 204. STAFF y MANAGER reciben 403 aunque tengan `sensitiveAccess=true`; OWNER recibe 409 para registros activos y 404 para registros inexistentes o de otra tienda. Se conservan autenticación y acceso a la sección.

La transacción Serializable revalida la membresía OWNER con bloqueo compartido y bloquea la fila por ID y tienda antes de comprobar el estado. El borrado y el evento `inventory|sale|client|trade|repair.permanently_deleted` se confirman juntos. Una falla de auditoría revierte también las dependencias eliminadas. Se conservan los eventos anteriores, el actor, el rol, la tienda, el ID y la etiqueta del registro borrado; el historial muestra «Borró definitivamente» y estado `gone`.

## Confirmación y dependencias

La acción aparece para OWNER y registros con baja previa en el menú contextual y en el detalle. El modal muestra etiqueta, identificador, aviso irreversible y consecuencias de la entidad. Exige escribir exactamente `BORRAR`; durante la petición muestra `Borrando…`, deshabilita botón principal, Cancelar e input y bloquea doble envío y cierre. Muestra errores dentro del modal sin cerrarlo como éxito.

| Falla | Mensaje |
| --- | --- |
| 404 | No encontramos este registro: puede que ya se haya borrado. Actualizá la pantalla. |
| 403 | Solo el dueño de la tienda puede borrar definitivamente. |
| 409 | Primero anulá o archivá el registro para poder borrarlo. |
| Red u otra | No se pudo borrar. Revisá tu conexión y reintentá. |

Se respetan las relaciones existentes:

- Venta: elimina sus tenders y planes/cuotas; conserva cliente, equipo, canje, reclamos y movimientos históricos de cuenta corriente/caja.
- Equipo: elimina precios y preferencias de visibilidad de catálogos; conserva ventas, canjes y reclamos con vínculo nullable.
- Cliente: elimina cobros, señas, planes/cuotas y notas de crédito/aplicaciones; conserva ventas, canjes, reparaciones y reclamos con vínculo nullable. Las señas se eliminan explícitamente por cliente y tienda dentro de la transacción porque su FK es `Restrict`.
- Canje: conserva venta y equipo recibido.
- Reparación: elimina eventos de estados; conserva cliente, cobros y auditoría.

El borrado definitivo no vuelve a modificar stock, saldos, caja ni comisiones. AppContext retira el registro después de la respuesta exitosa o de un 404, que confirma su ausencia. En 404 conserva la identificación del registro y el error dentro del modal; los demás errores conservan el registro local. Tras un éxito reconcilia las listas relacionadas al liberar el bloqueo de escritura. La revisión compartida de archivos invalida respuestas que comenzaron antes del borrado. Las respuestas de otra tienda no alteran las listas/cachés actuales, incluso si son 404.

## Validación

Seguimiento #703 (2026-11-04): 176 pruebas frontend relevantes aprobadas entre transporte de borrado, confirmación, concurrencia de AppContext, cliente HTTP y componentes de modal. Las URLs se prueban hasta `fetchWithTimeout` usando el cliente real, incluyendo `/api`, las cinco entidades, base con barra final e ID codificado. Typecheck de frontend/backend aprobado. Oxlint 1.90.0 aprobado con advertencias preexistentes; ejecutado con `npm exec --yes --package=oxlint@1.90.0 -- oxlint -c .oxlintrc.json src backend/src scripts` porque el binario local no estaba instalado. Sin cambios de backend ni acceso a bases en este seguimiento; commit solicitado sin push.

Validación de la implementación original:

- `npm run lint` y `npm --prefix backend run lint`: TypeScript sin emitir archivos; sin build.
- Suite completa frontend: 2.987 pruebas.
- Suite unitaria completa backend: 1.355 pruebas.
- Integraciones relacionadas: 93 pruebas en siete archivos, de las cuales 59 cubren el borrado definitivo. Incluyen las cinco entidades, STAFF con/sin permisos sensibles, MANAGER, OWNER, activos, bajas, aliases históricos, multi-tienda, autenticación, auditoría visible, rollback, doble borrado concurrente, dependencias y bajas lógicas existentes. Los otros archivos verifican permisos sensibles, restauración de ventas, inventario de autenticación de rutas, reparaciones, historial y CRUD principal.
- Regresiones React: visibilidad por rol/estado, etiqueta e ID, confirmación exacta, cancelación, error, doble envío, lectura archivada obsoleta, actualizaciones de AppContext y cambios de tienda durante una petición.

Se utilizó exclusivamente PostgreSQL nuevo en `127.0.0.1:55473/imanager_703_test` con datos ficticios. La DB y los temporales se alojaron en `/dev/shm/imanager-703-*` por el límite de inodos del disco compartido. Todas las integraciones se ejecutaron con `DATABASE_URL` local explícito. No se modificó schema Prisma ni se agregaron migraciones; sin acceso a DB de producción, build, deploy ni push.

Comando de integración reproducible desde la raíz, con una DB local exclusiva que ya tenga el schema:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55473/imanager_703_test \
npm --prefix backend run test:integration -- \
  src/test/permanent-delete.integration.test.ts \
  src/test/sensitive-actions.integration.test.ts \
  src/test/restore-sales.integration.test.ts \
  src/test/security-route-auth.integration.test.ts \
  src/test/repairs.integration.test.ts \
  src/test/repair-history.integration.test.ts \
  src/test/core-modules.integration.test.ts
```
