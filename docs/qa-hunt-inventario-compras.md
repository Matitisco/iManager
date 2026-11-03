# QA exploratorio: inventario y compras

2026-11-02 · base `origin/test` (`e4fa2a9`) · rama `qa/hunt-inventario-compras`.

Solo PostgreSQL local nuevo en `127.0.0.1:55537`, bases exclusivas `qa_hunt_inventario_compras` y `qa_hunt_inventario_compras_e2e`, tiendas y equipos ficticios. Sin producción, Railway, build ni cambios a #691.

| Bug confirmado | Severidad | Cómo reproducir / resultado anterior | Estado | PR |
|---|---|---|---|---|
| Compras mayoristas suma filas y costos unitarios, ignorando unidades | **Alta** | Importar con proveedor 10 iPhone a USD 300 y 3 a ARS 250.000. Compra: **2 equipos**, USD **300** + ARS **250.000**, en lugar de 13 y USD 3.000 + ARS 750.000. Vender 4 unidades: proveedor informa **2 en stock**, aunque quedan **9**. OWNER y STAFF afectados. | **Abierto, sin fix:** necesita separar cantidades adquiridas históricas del stock mutable. Tres tests de integración y dos E2E reproducen el defecto. | [PR] |
| Cantidad con IMEI vendido muestra una unidad inexistente | Media | Vender la única unidad de un equipo con IMEI. API y móvil muestran 0; escritorio mostraba **1**, aun con total “0 de 0”. | **Corregido:** celda muestra cantidad persistida, conserva default histórico 1 y permanece no editable. Test rojo→verde y E2E de venta/anulación. | [PR] |
| Total de Inventario activo incluye unidades archivadas ocultas | Media | Mantener 5 unidades activas y archivar una fila de 10. Una vez cargados los archivados, Todos mostraba **5 de 15** sin filtros. | **Corregido:** muestra **5 de 5**. Archivados y restauración siguen funcionando. Tests rojo→verde en móvil/escritorio y E2E con API real. | [PR] |
| CI conserva una expectativa anterior al fix del total activo | Baja (test; bloquea CI) | En `492e2c7`, ejecutar `npx vitest run src/desk/void-rows.test.tsx --maxWorkers=2`: los casos de 390 y 1440 px esperan **1 de 2** con un equipo activo y uno archivado; la pantalla devuelve correctamente **1 de 1**. | **Corregido:** el test abre Archivados, espera su fila, vuelve a la lista activa y exige **1 de 1**. Conserva las comprobaciones de Todos, Disponible y Archivados en ambos tamaños. | [PR] |

La inversión no puede calcularse simplemente multiplicando costo por cantidad actual: esa cantidad disminuye al vender. El pendiente de compras requiere conservar la cantidad adquirida y revisar ventas, devoluciones y ajustes históricos. En este PR no se modifica ese cálculo ni se cambia el schema.

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
- Esta continuación ejecuta validaciones sin DB ni servicios de producción y mantiene los permisos temporales de STAFF de #691. El defecto de compras de severidad alta sigue **abierto**; los fallos esperados documentados no significan que esté corregido.

**Los fallos esperados no son bugs corregidos.** `QA_HUNT_STRICT=1` los convierte en fallos normales; se verificaron los tres de integración en rojo. Los controles de setup, acceso STAFF a costos y layout se ejecutan antes de marcar la expectativa fallida.

Reproducción del pendiente en una DB **local descartable** (la suite de integración trunca tablas):

```bash
DATABASE_URL=postgresql://box@127.0.0.1:55537/qa_hunt_inventario_compras \
  QA_HUNT_STRICT=1 OPENAI_API_KEY= npm --prefix backend run test:integration -- \
  src/modules/suppliers/qa-hunt-purchases.integration.test.ts
```

Recorridos de navegador (la configuración rechaza servicios remotos y exige su base exclusiva):

```bash
DATABASE_URL=postgresql://box@127.0.0.1:55537/qa_hunt_inventario_compras_e2e \
  npx playwright test --config e2e/qa-hunt-inventario-compras.config.ts
```

Usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE` si Chromium está instalado fuera de Playwright. Para reproducir compras en rojo, agregar `QA_HUNT_STRICT=1` y `--grep ABIERTO`.

Capturas con datos ficticios: [compras desktop](qa-hunt-inventario-compras/compra-abierta-1440.png), [compras móvil](qa-hunt-inventario-compras/compra-abierta-390.png), [IMEI vendido](qa-hunt-inventario-compras/imei-vendido-1440.png), [total activo móvil](qa-hunt-inventario-compras/total-activo-390.png).

[PR]: https://github.com/Matitisco/iManager/pull/713
