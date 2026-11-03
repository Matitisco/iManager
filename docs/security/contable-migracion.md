# NO MERGEAR — requiere OK de Matias

PR B de `contable-estados-fks`. **No ejecutar en una base real ni integrar este PR sin la aprobación explícita de Matias.** Esta sesión sólo usó PostgreSQL local descartable con datos ficticios. El [PR A #737](https://github.com/Matitisco/iManager/pull/737) contiene la auditoría y defensa de servicios, sin schema/migración/backfill.

## Alcance y decisión SQL

Los archivos viven en `backend/prisma/manual/contable-migracion/`. Es una migración **manual por fases**: no está en `prisma/migrations/`, no se agrega al arranque y no se ejecuta al abrir un PR o hacer deploy. Este PR se entrega para revisión: **no mergear, incluso con CI verde**. No cambia `schema.prisma`, tipos de columnas ni FKs actuales.

El manifiesto cubre 58 relaciones: FKs físicas que sólo referencian `id` y referencias históricas sin FK. Para las físicas, la alternativa es `UNIQUE(id, storeId)` en el padre y FK compuesta en el hijo. Se eligen triggers porque preservan las acciones existentes de borrado, evitan índices únicos adicionales y no dependen de que Prisma represente `SET NULL` parcial: anular también `storeId` sería incorrecto. La prueba verifica que `prisma db push --skip-generate` conserva triggers/checks e índices parciales. Se crean índices parciales por cada referencia histórica para evitar scans completos en cada alta de un padre.

- Triggers del hijo comprueban existencia y misma tienda para las FKs físicas. Para referencias históricas permiten padre inexistente, pero nunca padre existente en otra tienda. No agregan cascadas ni limpian tombstones.
- Los padres no admiten reasignación de `storeId`. Reutilizar/cambiar un ID tampoco puede apropiarse de referencias históricas de otra tienda. Locks por ID y `KEY SHARE` serializan comprobación/inserción/borrado. En `REPEATABLE READ`, un padre histórico ausente provoca 40001; reintentar en READ COMMITTED o SERIALIZABLE. No hay endpoints legítimos de traslado de registros entre tiendas.
- La instalación usa transacciones **por tabla**, `lock_timeout=2s` y sin scan bajo lock exclusivo. No debe envolverse todo el archivo en otra transacción. Un timeout deja fases anteriores instaladas; corregir contención y repetir el archivo idempotente.
- Para relaciones, el equivalente a `NOT VALID` es instalar primero los triggers que protegen nuevas relaciones y luego contar/validar históricos con SELECT sin locks de escritura. `03-validate.sql` también exige que todos los guards estén activos; no afirma validación si falta alguno. No existe un `convalidated` de PostgreSQL para triggers.
- Los estados financieros cerrados reciben CHECK `NOT VALID`, y luego `VALIDATE CONSTRAINT` por tabla. Ventas/canjes y estado de pago del borrador conservan valores personalizados desconocidos; el check sólo exige forma canónica para alias reconocidos. Un estado desconocido no se convierte en venta cobrada.
- Se normalizan 13 campos de ventas/canjes/pagos/señas/comisiones/devoluciones/notas/caja. No se convierten textos de inventario/reparaciones personalizables ni snapshots JSON históricos. Compras no tienen estado: usan `deletedAt`. Cuotas derivan su estado de importes/fechas.

La defensa comprueba tienda; no sustituye las reglas de cliente de una venta, dueño de una seña, consistencia de registros de caja dentro de una sesión, ni efectos monetarios de una transición. No valida automáticamente los IDs polimórficos de auditoría/caja ni los actores globales. Superusuarios pueden desactivar triggers; los scripts operativos deben seguir usando servicios y auditar antes de actuar.

## Medir antes de aplicar: sólo lectura

Con una conexión **a test verificada por Matias**, ejecutar `00-precheck.sql` mediante el mecanismo habitual de credenciales, sin pegarlas ni guardarlas en el repo. El archivo no requiere funciones instaladas. Devuelve por relación: cruces entre tiendas, padres ausentes y si la referencia admite tombstone. Devuelve por campo: filas normalizables y desconocidas. No lista IDs, nombres ni importes.

Consultas adicionales de sólo lectura:

```sql
SELECT current_database(), current_schema(), inet_server_addr(), inet_server_port();

-- Medición básica y duplicados de estados. Repetir sobre tablas del manifiesto.
SELECT status, count(*) FROM "Sale" GROUP BY status ORDER BY count(*) DESC;
SELECT status, count(*) FROM "ClientDeposit" GROUP BY status;

-- Ejemplo de cruce físico: debe dar cero.
SELECT count(*) FROM "Sale" s JOIN "Client" c ON c.id = s."clientId"
WHERE s."storeId" <> c."storeId";

-- Referencia histórica: contar separados huérfanos permitidos y cruces prohibidos.
SELECT count(*) FILTER (WHERE s.id IS NULL) AS tombstones,
       count(*) FILTER (WHERE s.id IS NOT NULL AND s."storeId" <> p."storeId") AS cruces
FROM "ClientPayment" p LEFT JOIN "Sale" s ON s.id = p."saleId"
WHERE p."saleId" IS NOT NULL;

SELECT c.relname, t.tgname, t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname LIKE 'contable_%' ORDER BY c.relname, t.tgname;

SELECT conrelid::regclass, conname, convalidated
FROM pg_constraint WHERE conname LIKE 'contable_%_check';
```

Detenerse ante cruces, padres físicos faltantes, estados desconocidos de dominios cerrados o políticas financieras sin resolver. **No cambiar storeId, borrar filas ni asignar un padre por heurística.** Resolver cada caso requiere evidencia y OK de Matias. Los desconocidos de catálogos personalizados no son automáticamente errores.

## Orden de despliegue aprobado (primero test)

1. Matias identifica y verifica entorno/base de **test**, revisa conteos y autoriza alcance, ventana, backup y rollback. Aplicar A primero. Acordar pausas de escritores legacy/importadores externos durante backfill. No tocar producción en esta tarea.
2. Guardar backup por el mecanismo aprobado fuera del repo; registrar commit y conteos agregados, sin URLs/tokens. Revisar `manifest.json` frente al schema vigente; si cambió otra rama, actualizar y repetir las pruebas locales antes de ejecutar.
3. `00-precheck.sql`: medir. Cero cruces y cero huérfanos físicos antes de continuar normalmente. Los fixtures corruptos del test local son la única reparación de datos ejecutada en esta entrega.
4. `migration.sql`: repite el prechequeo, crea los índices de `01-reference-indexes.sql` con CONCURRENTLY y luego instala funciones, journal aislado y guards. Si una construcción concurrente falla puede quedar un índice inválido; el script exige indisvalid/indisready y se detiene antes de instalar guards. Tras revisar el nombre exacto propio, quitar sólo ese índice con DROP INDEX CONCURRENTLY y reintentar. No hace backfill ni cambia filas de negocio. No usar `psql --single-transaction` en instalación ni rollback de índices. Usar `psql -X -v ON_ERROR_STOP=1 -f <archivo>` con conexión segura provista por el operador.
5. `contable-backfill.mjs`: primero sin argumentos (dry run). Para aplicar, `node <ruta>/contable-backfill.mjs --apply --confirm-database=<nombre-verificado> --batch-size=500`. `DATABASE_URL` llega sólo por el gestor de secretos del job; no imprimirla ni guardarla en archivos. El runner respeta `sslmode`; para conexiones remotas usa `verify-full` por defecto. Nunca ejecutar con credenciales de producción en esta tarea.
6. El backfill cambia exclusivamente alias conocidos. Cada lote de hasta 500 filas hace journal y UPDATE de forma atómica, con `FOR UPDATE SKIP LOCKED`, timeout de 60s y locks de 2s. No cambia importes, FKs, timestamps de negocio ni campos desconocidos. Cada tabla/campo muestra sólo conteos. Si quedan filas bloqueadas/lotes pendientes, termina con código 2: reintentar en la ventana aprobada. Un error no deshace lotes anteriores; el journal permite revisar/retomar. Las filas nuevas guardadas por A ya usan forma canónica.
7. Repetir `00-precheck.sql` y dry run: cero candidatos normalizables. Desconocidos en dominios cerrados requieren una decisión; no se infiere su significado. Instalar `02-state-checks.sql` **después** del backfill; CHECK NOT VALID también se aplica a filas antiguas que se actualicen.
8. Ejecutar `03-validate.sql`: exige guards activos, cuenta cada relación y falla con cualquier violación; valida los CHECKs por separado. La validación de CHECK usa el lock de PostgreSQL compatible con DML habitual; `lock_timeout=2s` permite abandonar ante DDL concurrente. Una validación fallida no se declara éxito; no continuar con el despliegue.
9. En test, comprobar creaciones/cobros/cancelaciones/devoluciones/comisiones/caja normales de A, permisos STAFF de #691 y rechazos de vínculos cruzados. Verificar que los conteos y totales monetarios de antes/después coincidan; sólo deben variar los textos aprobados. Confirmar guards y CHECKs validados tras otro arranque con `db push`.
10. Registrar evidencia agregada y mantener el journal hasta cerrar la ventana de rollback. Cualquier traslado a otro entorno requiere otra aprobación de Matias; **este PR jamás se mergea automáticamente**.

## Rollback y recuperación parcial

1. Detener escritores involucrados en la ventana aprobada. Ejecutar `rollback-checks.sql` para permitir los spellings originales.
2. Dry run de aplicación no restaura valores. Para restaurar: `node <ruta>/contable-backfill.mjs --rollback --confirm-database=<nombre-verificado> --batch-size=500`.
3. Se restauran valores originales exactos sólo si el campo aún coincide con el resultado de nuestro backfill y, si la tabla tiene `updatedAt`, también coincide ese timestamp de la fila. No se pisan cambios posteriores ni se resucitan filas borradas. Pendientes/ediciones posteriores dan código 2 y conteos para revisión manual. En tablas sin `updatedAt` la evidencia se limita a la igualdad del campo; si hubo una edición posterior que volvió al mismo valor, no puede distinguirse: revisar antes de autorizar ese rollback.
4. `rollback-guards.sql` quita únicamente los triggers/funciones propios. No elimina FKs previas, datos de negocio ni el journal. Antes de quitar guards, confirmar que A sigue activo y entender que se pierde la defensa SQL adicional.
5. El journal vive en `contable_migration."StateBackfill"`, fuera de `public` para que `db push` no lo proponga borrar. No contiene secretos ni importes, pero conserva IDs/textos de estado: no publicarlo como artefacto. Limpieza/retención requieren aprobación separada; no se borra automáticamente.

## Prueba local reproducible y evidencia

Crear una instancia PostgreSQL propia en loopback con puerto aleatorio >20000 y DB `contable_migracion` (o sufijo de tarea), sin reutilizar procesos/bases ajenos. No ejecutar los scripts de arranque compartidos que usan puertos/bases fijos.

```bash
# Sólo con DATABASE_URL ya configurada a esa DB local exclusiva.
node --test --test-concurrency=1 backend/prisma/manual/contable-migracion/contable-migracion.test.mjs
```

El harness rechaza destinos remotos, puertos bajos y nombres ajenos; prepara sólo esa base con el schema actual, siembra dos tiendas ficticias y ejecuta fases reales por psql. Incluye cruces en Sale→Client, CashSession→CashRegister y ClientPayment→Sale, alias, estado desconocido y catálogo personalizado; no desactiva FKs para sembrar. Comprueba las 58 relaciones con controles positivos, instalación/backfill idempotentes, rechazo de storeId/reutilización de tombstones, `NOT VALID`/`VALIDATE`, `SET NULL`, supervivencia de guards al `db push`, rollback exacto y preservación de ediciones posteriores. No usa Firebase ni datos/servicios reales. Sin build ni suite completa local.

Resultado local: **68 pruebas aprobadas**, incluyendo dos conexiones concurrentes, índices parciales preservados tras `db push`, validación que falla si se desactiva un guard, y rollback que conserva un `updatedAt` posterior. PostgreSQL exclusivo en loopback, puerto aleatorio 42211; sólo las DBs de esta tarea. No se aplicó nada en test ni producción.
