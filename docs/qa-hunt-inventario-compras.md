# QA exploratorio: inventario y compras

2026-11-02 · base `origin/test` (`e4fa2a9`) · rama `qa/hunt-inventario-compras`.

Solo PostgreSQL local nuevo en `127.0.0.1:55537`, bases exclusivas `qa_hunt_inventario_compras` y `qa_hunt_inventario_compras_e2e`, tiendas y equipos ficticios. Sin producción, Railway, build ni cambios a #691.

| Bug confirmado | Severidad | Cómo reproducir / resultado anterior | Estado | PR |
|---|---|---|---|---|
| Compras mayoristas suma filas y costos unitarios, ignorando unidades | **Alta** | Importar con proveedor 10 iPhone a USD 300 y 3 a ARS 250.000. Compra: **2 equipos**, USD **300** + ARS **250.000**, en lugar de 13 y USD 3.000 + ARS 750.000. Vender 4 unidades: proveedor informa **2 en stock**, aunque quedan **9**. OWNER y STAFF afectados. | **Corregido en el seguimiento:** snapshot de unidades adquiridas separado del stock; importación y carga manual, OWNER/STAFF, USD/ARS y ciclo de ventas/devoluciones cubiertos. Ver detalle del fix y backfill más abajo. | [PR] |
| Cantidad con IMEI vendido muestra una unidad inexistente | Media | Vender la única unidad de un equipo con IMEI. API y móvil muestran 0; escritorio mostraba **1**, aun con total “0 de 0”. | **Corregido:** celda muestra cantidad persistida, conserva default histórico 1 y permanece no editable. Test rojo→verde y E2E de venta/anulación. | [PR] |
| Total de Inventario activo incluye unidades archivadas ocultas | Media | Mantener 5 unidades activas y archivar una fila de 10. Una vez cargados los archivados, Todos mostraba **5 de 15** sin filtros. | **Corregido:** muestra **5 de 5**. Archivados y restauración siguen funcionando. Tests rojo→verde en móvil/escritorio y E2E con API real. | [PR] |
| CI conserva una expectativa anterior al fix del total activo | Baja (test; bloquea CI) | En `492e2c7`, ejecutar `npx vitest run src/desk/void-rows.test.tsx --maxWorkers=2`: los casos de 390 y 1440 px esperan **1 de 2** con un equipo activo y uno archivado; la pantalla devuelve correctamente **1 de 1**. | **Corregido:** el test abre Archivados, espera su fila, vuelve a la lista activa y exige **1 de 1**. Conserva las comprobaciones de Todos, Disponible y Archivados en ambos tamaños. | [PR] |

La inversión no puede calcularse multiplicando costo por cantidad actual: esa cantidad disminuye al vender. El PR de exploración #713 dejó el pendiente documentado; el seguimiento descrito abajo lo corrige con un snapshot histórico y migración aditiva.

Validación de la exploración inicial:

- TypeScript frontend, backend y los nuevos E2E: sin errores.
- Selección de CI de frontend: **235 pruebas aprobadas**, incluidas **65** de Inventario y las regresiones compartidas de archivados.
- Backend unitario completo: **1.061 aprobadas**.
- Integración relacionada: **98 aprobadas + 3 fallos esperados** del pendiente de compras; PostgreSQL real local. Incluye cantidades >1, sobreventa concurrente, venta/anulación/restauración, cuenta corriente, devoluciones parciales, importación y reimportación, onboarding, monedas, aislamiento entre tiendas y permisos STAFF.
- Chromium: **8 recorridos correctos + 2 fallos esperados** de compras, con API real local, a **1440 y 390 px**. Excel sintético desde onboarding e Inventario; cantidad/IMEI; venta/anulación; archivado/restauración. Sin desborde horizontal de página en las vistas verificadas.
- La primera corrida amplia se interrumpió por saturación de memoria del entorno compartido; los checks relacionados se repitieron con concurrencia reducida. No se completó la suite global de frontend.

Seguimiento del CI del PR #713:

- [Corrida inicial sobre `492e2c7`](https://github.com/Matitisco/iManager/actions/runs/41544464750): lint, backend, smoke E2E y PWA aprobados. Frontend: **233 aprobadas y 2 fallidas** por la expectativa anterior; el agregador `test` falló como consecuencia.
- El ajuste pendiente del worktree se revisó y validó: **97 pruebas aprobadas** entre `void-rows.test.tsx` e `InventoryScreen.test.tsx`; TypeScript frontend y backend aprobados en paralelo.
- La selección de frontend usada por CI, aplicada al diff completo del PR y al ajuste pendiente, pasó localmente: **235 pruebas en 12 archivos**, con un máximo de dos workers. No se ejecutó un build ni se repitió la suite global.
- [Corrida remota del fix `ac6dfe5`](https://github.com/Matitisco/iManager/actions/runs/41557861444): **7/7 checks aprobados** (`changes`, `lint`, `backend-tests`, `frontend-unit (1)`, `e2e (0)`, `pwa (android-chromium)` y `test`). El PR permanece abierto contra `test`, sin merge.
- Esta continuación ejecuta validaciones sin DB ni servicios de producción y mantiene los permisos temporales de STAFF de #691. El defecto de compras de severidad alta sigue **abierto**; los fallos esperados documentados no significan que esté corregido.

**Evidencia histórica de #713:** sus tres tests de integración se verificaron en rojo con `QA_HUNT_STRICT=1`. El seguimiento retiró `it.fails`, `test.fail` y el flag de estas pruebas: ahora son regresiones normales que deben pasar.

Reproducción del pendiente en una DB **local descartable** (la suite de integración trunca tablas):

```bash
DATABASE_URL=postgresql://box@127.0.0.1:55537/qa_hunt_inventario_compras \
  OPENAI_API_KEY= npm --prefix backend run test:integration -- \
  src/modules/suppliers/qa-hunt-purchases.integration.test.ts
```

Recorridos de navegador (la configuración rechaza servicios remotos y exige su base exclusiva):

```bash
DATABASE_URL=postgresql://box@127.0.0.1:55537/qa_hunt_inventario_compras_e2e \
  npx playwright test --config e2e/qa-hunt-inventario-compras.config.ts
```

Usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE` si Chromium está instalado fuera de Playwright. Las pruebas de compras ahora se ejecutan normalmente sin flags de fallos esperados.

Capturas con datos ficticios: [compras desktop](qa-hunt-inventario-compras/compra-abierta-1440.png), [compras móvil](qa-hunt-inventario-compras/compra-abierta-390.png), [IMEI vendido](qa-hunt-inventario-compras/imei-vendido-1440.png), [total activo móvil](qa-hunt-inventario-compras/total-activo-390.png).

[PR]: https://github.com/Matitisco/iManager/pull/713


## Seguimiento: corrección de compras por proveedor

Base `origin/test` (`26b0e1b`), rama `fix/proveedores`. **También pasaba con carga manual**: se reprodujeron seis fallos normales antes del cambio, tanto para importación como para alta manual. Una fila de diez unidades mostraba un equipo y un solo costo unitario; la venta parcial dejaba el conteo en filas.

Ahora `InventoryItem.acquiredQuantity` guarda las unidades adquiridas al crear stock. Compras y proveedor suman ese snapshot y multiplican costo unitario × unidades adquiridas, con totales USD/ARS separados. El stock del proveedor suma `cantidad` remanente de filas no vendidas. Vender, editar stock, anular o restaurar ventas no modifica la adquisición. Una devolución que separa unidades en otra fila conserva proveedor/compra y lleva adquisición **0**: suma stock sin otra compra ni otra inversión. Se omiten esas filas al agrupar monedas de inversión. Se conserva el alcance existente de filas no archivadas, el conteo de problemas/reclamos por registro y los permisos temporales de STAFF de #691.

### Migración y backfill

Migración formal: `backend/prisma/migrations/20261102180000_supplier_acquired_quantity/migration.sql`. Agrega **un campo INTEGER nullable, sin default**. El mismo SQL está integrado al `pre-push.sql` existente para el arranque que usa `db push`; no se ejecutó en ningún servicio remoto.

Solo completa snapshots `NULL` mediante:

`cantidad adquirida = cantidad actual + unidades vendidas que descontaron stock - unidades repuestas físicamente en esa fila`.

Supuestos y resguardos:

- Ventas con `stockDeducted=true`, activas, completadas o pendientes: suman sus unidades. Anuladas/canceladas no suman; las históricas sin descuento tampoco. Una venta archivada que consumió stock sigue contando.
- Se restan devoluciones con resolución física hacia STOCK o PROVEEDOR que repusieron unidades: ventas con descuento de stock, o ventas históricas de múltiples unidades cuyo flujo también genera reposición. Las ventas históricas unitarias sin descuento no reponen cantidad. `ReturnCase.cantidad=NULL` significa toda la cantidad vendida. No se restan reclamos abiertos ni resoluciones que dejan el equipo con el cliente.
- Se atribuye la reposición al `inventoryItemId` **actual del reclamo**, que puede ser una fila separada. Una fila devuelta y revendida puede reconstruir adquisición cero. Reclamos archivados/anulados conservan sus efectos físicos y se incluyen. La reparación RMA de una venta con descuento, ya recibida por el cliente, no conserva la reposición en stock.
- Se cruzan tienda e ID. Los cálculos usan sumas amplias; candidatos negativos o fuera de INTEGER permanecen `NULL` para revisión. La lectura reconstruye los nulls con la misma fórmula y devuelve error visible si encuentra una inconsistencia.
- No se sobreescriben snapshots conocidos, ni cantidades actuales, ventas, reclamos, timestamps o notas. No se borra nada. La ejecución es idempotente; se probaron migración repetida, arranque pre-push y tabla anterior sin la nueva columna.
- La reconstrucción supone que el stock actual y las ventas/reposiciones vinculadas registran los movimientos físicos. Ajustes históricos sin registro, ventas eliminadas o vínculos borrados impiden recuperar la compra exacta: la fórmula no inventa esos movimientos. Desde este cambio, los snapshots conocidos permanecen separados incluso si se ajusta stock manualmente.

### Validación del seguimiento

Solo PostgreSQL nuevo en `127.0.0.1:55587`, bases exclusivas `fix_proveedores_test` y `qa_hunt_inventario_compras_e2e`, datos ficticios. Sin build, producción, Railway ni merge.

- TypeScript frontend/backend: aprobado.
- Backend unitario completo: **1.061** pruebas aprobadas.
- Frontend relacionado: **132** pruebas aprobadas (proveedores, Inventario y archivados).
- **34 regresiones nuevas aprobadas**: matriz importación/manual × OWNER/STAFF; inversión USD/ARS, venta parcial y total, devolución, reventa, anulación de reclamo/venta, restauración, edición de stock y reimportación de un IMEI vendido; backfill y lectura de snapshots null.
- La primera suite global de integración terminó con **822 aprobadas, 3 fallidas y 2 fallos esperados ajenos** del pendiente de ventas/devoluciones #714. Tras completar los casos históricos del backfill, las **34 regresiones finales** de compras/migración pasan; el caso ARS que agotó tiempo en la corrida amplia también pasó al repetirlo. El fallo de SMTP simulado se repitió idéntico usando una copia limpia de `origin/test` con la misma base local: limitación previa del entorno, sin modificar ese módulo. La verificación remota del PR se registra en su descripción.
- Chromium: **12/12** recorridos aprobados a **1440 y 390 px**, incluidos importación/manual → diez adquiridos, USD 3.000 → venta de cuatro → seis en stock y USD 3.000 → anulación → diez en stock y USD 3.000. Onboarding, IMEI y archivados conservan sus regresiones.

Capturas después de vender cuatro unidades: [manual móvil](fix-proveedores/manual-venta-390.png), [importación escritorio](fix-proveedores/import-venta-1440.png).
