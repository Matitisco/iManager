# Concurrencia de miembros de tienda

Trabajo sobre `origin/test`, exclusivamente con PostgreSQL descartable `miembros_concurrencia` en `127.0.0.1:55747`. Sin producción, build, schema, migraciones ni cambios de #691.

## Hallazgos y corrección

Las validaciones de rol del objetivo y el conteo de propietarios en `updateMemberRole` y `removeMember` ocurrían fuera de la transacción. Dos peticiones podían observar dos OWNER, confirmar ambas degradaciones/bajas y dejar cero propietarios activos. Un MANAGER también podía remover un STAFF promovido a OWNER entre el chequeo y la escritura. Los servicios confiaban en el rol del actor resuelto antes de su baja/degradación; rol y permisos podían editar objetivos removidos. Activar una tienda removida devolvía éxito, aunque las consultas de negocio ya filtraban la membresía removida.

Cambios de rol, permisos y bajas ahora toman `SELECT id FROM "Store" WHERE id = $1 FOR UPDATE` dentro de una transacción **ReadCommitted**. Después del lock se releen actor activo, objetivo activo y propietarios activos. El lock compartido por tienda protege también la promoción de STAFF a OWNER; el conteo y la escritura son atómicos respecto de las demás mutaciones. ReadCommitted permite ver el commit que precedió a una espera del lock. Un OWNER removido no cuenta como propietario ni autoriza operaciones. Baja y auditoría confirman o revierten juntas.

Aceptación, creación/cancelación de invitaciones y activación de tienda usan el mismo lock. Se conservan los locks previos por usuario/enlace y la clave única **existente** `StoreMember(storeId, userId)`: una cuenta no puede tener membresías duplicadas de la misma tienda y un enlace solo se consume una vez. Las reincorporaciones siguen exigiendo una invitación pendiente y reemplazan permisos por los de esa invitación, como en #728. Una baja concurrente con una aceptación se resuelve según el orden de adquisición: una aceptación posterior puede reincorporar explícitamente; una baja posterior revoca el acceso.

Orden de locks: **usuario → invitación → billing → fila Store**, omitiendo los innecesarios. Billing se adquiere antes de Store para respetar los servicios de facturación existentes. No se toman locks de usuario/invitación/billing mientras se posee la fila Store. Tiendas distintas tienen filas distintas; no existe un mutex global de equipo ni dependencia de memoria de un proceso.

`withMembershipTransaction` reintenta la transacción completa hasta **tres intentos** ante `P2034`, SQLSTATE `40001` o `40P01` (incluidos errores raw `P2010`). Al agotarlos responde 409 con un mensaje seguro para reintentar. No reintenta autorización, unicidad ni otros errores SQL. Analytics permanece después del commit; auditoría permanece dentro de la transacción.

## Evidencia reproducible

`backend/src/modules/stores/miembros-concurrencia.integration.test.ts` ejecuta peticiones Fastify y servicios con Prisma/PostgreSQL reales y `Promise.all`/`Promise.allSettled`. Las barreras fuerzan la intercalación insegura de los conteos originales fuera de transacción; no sustituyen SQL ni retornan datos inventados. La implementación corregida cuenta mediante `tx` después del lock.

Batería final sobre los servicios originales: **11 fallos de 15 pruebas**. Los tres pares PATCH/PATCH, DELETE/DELETE y PATCH/DELETE y las bajas mutuas de propietarios dejaron **cero OWNER activos**, confirmado con SQL. También fallaron promoción concurrente con baja, actor degradado/removido, objetivo removido, invitaciones con actor removido, reintento de serialization failure y activación tras baja. Las regresiones de aceptación simultánea ya pasaban y se conservan. Con el arreglo: **15/15 aprobadas**.

La cobertura también verifica creación/cancelación con actor removido y rollback de baja **y auditoría** ante un `40001` emitido por PostgreSQL después de ambas escrituras, seguido de reintento exitoso con un único evento. Las unitarias de `member-transaction.test.ts` verifican el límite de reintentos y los errores no reintentables.

Para repetir: preparar una base local exclusiva con el schema vigente (`prisma db push --skip-generate`, sin modificarlo), configurar `DATABASE_URL` solo en el entorno del comando y ejecutar desde `backend`:

```sh
npm run test:integration -- src/modules/stores/miembros-concurrencia.integration.test.ts --maxWorkers=1
npm run test:unit -- src/modules/stores/member-transaction.test.ts src/modules/stores/stores.service.test.ts src/modules/stores/sections.test.ts src/modules/invitations/invitations.test.ts src/modules/invitations/invitations.routes.test.ts --maxWorkers=2
```

El helper de integración trunca la base: usar exclusivamente una base descartable propia. Auth usa el bypass de pruebas existente; no se llama a Firebase real.

Validación local final: **40 integraciones** de miembros, permisos de equipo, gestión, onboarding y autorización aprobadas; **39 unitarias** relacionadas y TypeScript frontend/backend aprobados. De 58 integraciones relacionadas de billing, 52 pasaron inicialmente y seis fallaron durante una sobrecarga del host (load > 200): timeouts y un deadlock del TRUNCATE posterior a un timeout. Se repitieron únicamente los casos afectados y sus parametrizaciones: **9/9 aprobados**, con un worker y timeout de test elevado solo por CLI. No se cambió configuración global ni se ejecutó la suite completa local.

## PR y CI

PR [#732](https://github.com/Matitisco/iManager/pull/732), base `test`. **Abierto, sin merge**: la regla de integrar únicamente con TODO CI verde no se cumple.

- [CI relacionada del PR](https://github.com/Matitisco/iManager/actions/runs/41685445266): verde, incluyendo frontend, backend y lint.
- [Suite completa solicitada por workflow_dispatch](https://github.com/Matitisco/iManager/actions/runs/41685451802): backend y lint verdes; corrida global roja por UI/E2E/PWA y una prueba frontend de `ImportModal.panel.test.tsx` (espera 44 filas y obtiene cero).
- Ejemplos concretos: `e2e/install-help-cases.ts:108` espera que el hermano de la tarjeta sea `more-profile` y recibe null; `e2e/pwa/install.spec.ts:329` espera un botón Importar ausente; `e2e/edit-sale-seller.flow.ts:108` espera Anular sobre una venta ya anulada; `e2e/service-dollar.spec.ts:27` espera un texto de actualización que no aparece. Hay además fallos de importación, archivado y layout en los shards E2E. Los casos PWA usan respuestas HTTP ficticias y no ejecutan los servicios de miembros modificados.

No se modificaron frontend, PWA ni E2E en este PR. Los fallos de aserciones PWA/E2E se repiten en el retry interno del runner, por lo que no se asumen flakes ni se cambia su comportamiento para forzar un verde. Falta resolver o contrastar esos fallos de la suite global antes de integrar; no se certifica ausencia de regresiones UI mediante una CI roja. No se hizo rebase/merge a test ni se accedió a main/producción.

## Alcance y pendientes

- No requiere OK de Matias para políticas nuevas: restituye invariantes y permisos ya previstos. Conserva costos/ganancias STAFF (#691), enlaces transferibles y matriz OWNER/MANAGER/STAFF.
- Después del commit de baja, el mismo token pierde acceso en nuevas solicitudes; `/api/me` no devuelve esa membresía y activar esa tienda responde 404. Las mutaciones de equipo que estaban en vuelo revalidan actor y objetivo después del lock. No se cancela retroactivamente una operación de otro módulo que ya había sido autorizada antes de la baja.
- No se reparan tiendas históricas que ya estuvieran sin OWNER ni se inventa un propietario. Un diagnóstico/backfill de esos datos necesita autorización separada y acceso al entorno correspondiente; no se realizó.
- La invariante de al menos un OWNER se garantiza en estos flujos del backend. Escrituras SQL directas o nuevos mutadores deben respetar el mismo protocolo; una garantía independiente de la aplicación necesitaría un trigger/constraint diferible y una migración, fuera de alcance. La unicidad por tienda/usuario ya está en el schema: no queda pendiente agregar otra constraint equivalente.
