# QA exploratorio · ventas y devoluciones

Base: `origin/test` (`e4fa2a9`), rama `qa/hunt-ventas-devoluciones`. Fecha: 2026-11-02. Todos los datos son ficticios; no se usaron cuentas reales de Natan, Juan ni iPh Concordia.

PR inicial a `test`: [#714](https://github.com/Matitisco/iManager/pull/714) — fixes HVD-01/02/03 y documentación original de HVD-04.

## Corrección HVD-04 · anulación consistente

Continuación en `fix/anular-devolucion`, base `origin/test` (`26b0e1b`). Se elige **bloquear la anulación de cualquier reclamo con compensación emitida**: `DELETE /api/returns/:id` devuelve HTTP 409 con «Este reclamo tiene una compensación emitida. Anulá primero el reintegro o la nota de crédito antes de anular el reclamo.». Incluye notas abiertas, parcialmente utilizadas y consumidas; un borrado lógico de la nota tampoco demuestra una reversión financiera. El marcador persistido de reintegro/nota y cualquier nota vinculada protegen el reclamo.

El rechazo ocurre antes de escribir, dentro de la transacción Serializable y el lock por tienda que comparten resolución y aplicación de notas. Conserva estado, eventos, auditoría, reintegro, caja, aplicaciones, stock, acumulado del cliente, facturación y ganancia. El modal explica la regla y mantiene el mensaje visible sin cerrar como éxito.

Sin compensación, la anulación revierte stock/RMA y cambia estado, evento y auditoría en **una sola transacción**. Facturación, ganancia y acumulado del cliente se conservan porque no hubo descuento monetario que deshacer. La fila física devuelta queda sin unidades disponibles; el remanente original y la semántica histórica de una unidad sin descuento previo se preservan. Se libera el alcance del reclamo recién anulado; históricos anulados que conservan efectos siguen consumiendo unidades. Reserva, reventa, cantidades/estado modificados o referencias ambiguas producen 409 sin escrituras parciales.

**Límite deliberado:** hoy no hay operación de reversión integral de reintegros/notas. Este fix no agrega esa operación ni permite simularla borrando una nota. Los reclamos compensados quedan bloqueados hasta disponer de una reversión válida; no se reparan anulaciones históricas. No cambian permisos sensibles ni la visibilidad financiera temporal de STAFF de #691. Sin cambios de schema ni AppContext.

**Evidencia rojo → verde:** los dos `it.fails` originales se convirtieron en `it.each`. Sobre la base ambos fallaron con «expected 204 to be 409»; con el fix pasan como pruebas normales. `returns-cancellation.integration.test.ts` agrega 39 regresiones: USD/ARS, completa/parcial, reintegro/nota, OWNER/STAFF, notas parcial/totalmente utilizadas, borrado lógico, reparaciones/RMA, históricos, aislamiento, concurrencia y rollback por fallo de auditoría después de mutar stock/estado/evento. Los snapshots comparan las tablas afectadas y las métricas antes/después. Se actualizan expectativas previas que permitían el comportamiento defectuoso, conservando límites económicos y de unidades.

La validación de esta continuación usa PostgreSQL nuevo exclusivo en `127.0.0.1:55483`, bases `hvd04_test` y `hvd04_e2e`, con datos sintéticos. Sin build, producción, Railway ni secretos en salida. El resto de este documento conserva la evidencia histórica de #714; sus fallos esperados y su CI no describen el estado de este fix.

Validación local aprobada: TypeScript frontend/backend/E2E; 1.061 unitarias backend (107 archivos), 73 frontend relacionadas (6 archivos), 149 integraciones únicas (13 archivos). Estas últimas combinan la suite inicial de 99, la repetición final de 39 regresiones de anulación (con tres casos adicionales) y 47 de operaciones/anulación/restauración de ventas. Ninguna queda como fallo esperado. Chromium: **2/2 recorridos en 1440/390 px**, con devolución parcial USD, cuenta ARS, intento real de anulación, mensaje 409 visible y persistencia tras recarga. La primera prueba ampliada falló por un selector de menú; se corrigió usando menú contextual en escritorio y el botón hermano de la fila en móvil. Los primeros intentos sin binario local válido no ejecutaron pruebas. No se certifica WebKit.

| Bug confirmado | Severidad | Cómo reproducir sobre la base | Estado |
|---|---|---|---|
| HVD-01 · devolución mezcla USD/ARS en compras acumuladas del cliente | Alta | Cliente con cuenta ARS y acumulado previo 50; vender USD 100 a 1250; devolver USD 50. Queda 125000 en vez de ARS 62550. En sentido ARS→USD puede borrar todo el acumulado. Afecta reintegros y notas. | Corregido: Decimal, moneda de cuenta/local y cotización histórica; falta de cotización produce error y rollback. |
| HVD-02 · una nota puede cubrir más de su saldo | Alta | Emitir nota USD 100 y crear venta USD 150 enviando `creditNoteIds: [id, id]`. Aplica 150, no cobra los 50 restantes y deja saldo utilizable. Reproducción por API; no se confirmó un disparador desde la UI. | Corregido: IDs únicos antes de planificar aplicaciones. |
| HVD-03 · varios reclamos superan la cantidad vendida después de editarla | Alta | Vender 4 unidades; abrir dos reclamos de 2; editar venta a 2 unidades. Antes permite resolver ambos con importes pequeños dentro del límite económico, reponiendo unidades por encima de lo vendido. | Corregido: revalidación conjunta al resolver; HTTP 409 sin efectos hasta revisar/anular el reclamo sobrante. |
| HVD-04 · anular un reclamo resuelto hace reaparecer facturación | Alta | Vender USD 100 (costo 60), reintegrar 100 o emitir nota, anular el reclamo. Dashboard vuelve de 0 a 100 de facturación aunque el reintegro/nota y la reposición siguen vigentes. | Corregido en esta continuación: HTTP 409 ante compensación emitida; sin compensación, reversión física transaccional. Ambos `it.fails` son tests normales verdes. |

## Cierre histórico del PR #714 y CI

Continuación del 2026-11-02: PR #714 abierto, base `test`, head `qa/hunt-ventas-devoluciones`, sin conflictos. `gh pr checks 714` confirmó **8/8 checks aprobados** sobre `f7354fca4321c4c834d0a8e60c07b54165f1a036`: `changes`, `lint`, `backend-tests`, `frontend-unit (1)`, `frontend-unit (2)`, `pwa (android-chromium)`, `e2e (0)` y el agregador obligatorio `test`. Evidencia: [ejecución CI 41544769894](https://github.com/Matitisco/iManager/actions/runs/41544769894), completada el 2026-11-02 a las 23:29:44 UTC.

No había fallos de CI que corregir al retomar. Esta continuación completa documentación y el checklist de OpenSpec; no agrega cambios funcionales. El CI del PR selecciona pruebas a partir del diff completo y ejecutó cinco E2E smoke y dos controles PWA Android Chromium. Esos jobs no equivalen a repetir los 30 recorridos exploratorios locales ni certifican WebKit. El recorrido específico `e2e/hunt-ventas-devoluciones.spec.ts` no tiene `@smoke`: su evidencia corresponde a la ejecución local registrada abajo. El estado del último push se consulta con `gh pr checks 714` en el [PR #714](https://github.com/Matitisco/iManager/pull/714).

**Estado al cerrar #714:** HVD-01, HVD-02 y HVD-03 corregidos en `1e5165e`, con regresiones; HVD-04 quedó abierto, severidad alta, sin fix en aquel PR. Los dos `it.fails` de entonces reproducían el defecto esperado; no eran evidencia de corrección. La continuación detallada arriba los reemplaza por tests normales. Para reproducirlo sobre la base anterior por API local, resolver un reclamo con `POST /api/returns/:id/resolve` (reintegro o nota), consultar `GET /api/reports/overview?rangeKey=all_time`, anular con `DELETE /api/returns/:id` y volver a consultar el overview. Con el fix, DELETE rechaza con 409 y la facturación conserva el descuento mientras sigue vigente la compensación.

Entrega únicamente en la rama del PR, sin merge. #691 sigue presente en la historia y este PR no modifica sus permisos temporales de STAFF. Esta continuación no ejecutó build, servicios de aplicación, comandos Railway ni acceso a bases de datos; solo inspección de Git/CI, TypeScript y documentación.

## Pruebas y evidencia históricas de #714

- Regresiones: `backend/src/test/qa-hunt-ventas-devoluciones.integration.test.ts`. La primera corrida sobre la base produjo seis fallos para HVD-01/02/03; luego se amplió a ocho combinaciones de moneda/tipo de compensación, cuenta explícita/heredada y cotización actual distinta de la histórica, más rollback sin cotización.
- Navegador: `e2e/hunt-ventas-devoluciones.spec.ts`, devolución parcial USD con cuenta ARS en 1440 y 390 px, persistencia tras recarga, stock, facturación, margen y errores de página.
- TypeScript frontend/backend aprobado; 1061 unitarias backend, 154 integraciones aprobadas y 2 fallos esperados documentados (19 archivos), 79 pruebas frontend relacionadas aprobadas (9 archivos). Regresión final aislada: 11 aprobadas y 2 fallos esperados.
- Navegador: 30 recorridos distintos aprobados entre rondas, con un worker: ventas, cantidades/monedas, devolución parcial, permisos OWNER/STAFF, restauración/anulación y onboarding (incluido Excel). Las repeticiones finales completaron 19 recorridos y luego 4 controles (incluyen un recorrido ya aprobado). Se actualizan expectativas preexistentes de “Ganancia total”, cero ventas y dos registros con tres unidades en onboarding; restauración/anulación móvil usa el botón visible “Más acciones” para evitar eventos sintéticos de pulsación larga. No se cambió la UI para acomodar los tests.
- Chromium en 1440/390/360 px y emulación de iPhone. WebKit no se pudo ejecutar: faltan bibliotecas del sistema y la instalación de dependencias falló por acceso al repositorio de paquetes. Los dos controles de anulación configurados para WebKit se aprobaron con un config temporal que fija Chromium; no se certifica Safari.
- Los dos fallos esperados de HVD-04 se reportan separadamente de las pruebas aprobadas. La suite verde no significa que ese bug esté resuelto.

## Entorno y alcance históricos de #714

PostgreSQL nuevo y exclusivo en `127.0.0.1:55477`, bases `qa_hunt_ventas_test` (integraciones) y `qa_hunt_ventas_e2e` (navegador). Frontend Vite local y API con autenticación de test. Sin build, deploy, migraciones, producción ni comandos Railway. #691 conserva STAFF con costos y ganancias.

Se revisaron transacciones de ventas/reclamos, cantidades, moneda, límites económicos y permisos. Los recorridos/suites cubren ventas a cuenta, anulaciones, restauración, importaciones y onboarding según el detalle de validación. No se certifica toda la app ni se modifican datos históricos para reparar acumulados ya afectados.

Las primeras corridas amplias de frontend/integraciones/E2E se interrumpieron por saturación compartida (load average >200 y timeouts). No se presentan como aprobadas ni como bugs confirmados; se repiten los recorridos relevantes con concurrencia acotada.

Para reproducir las regresiones, con esa base local ya sincronizada:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55477/qa_hunt_ventas_test npm --prefix backend run test:integration -- qa-hunt-ventas-devoluciones
DATABASE_URL=postgresql://postgres@127.0.0.1:55477/qa_hunt_ventas_e2e PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4187 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3187 npx playwright test e2e/hunt-ventas-devoluciones.spec.ts --workers=1
```
