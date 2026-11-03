# QA exploratorio · ventas y devoluciones

Base: `origin/test` (`e4fa2a9`), rama `qa/hunt-ventas-devoluciones`. Fecha: 2026-11-02. Todos los datos son ficticios; no se usaron cuentas reales de Natan, Juan ni iPh Concordia.

PR a `test`: [#714](https://github.com/Matitisco/iManager/pull/714) — fixes HVD-01/02/03 y documentación de HVD-04.

| Bug confirmado | Severidad | Cómo reproducir sobre la base | Estado |
|---|---|---|---|
| HVD-01 · devolución mezcla USD/ARS en compras acumuladas del cliente | Alta | Cliente con cuenta ARS y acumulado previo 50; vender USD 100 a 1250; devolver USD 50. Queda 125000 en vez de ARS 62550. En sentido ARS→USD puede borrar todo el acumulado. Afecta reintegros y notas. | Corregido: Decimal, moneda de cuenta/local y cotización histórica; falta de cotización produce error y rollback. |
| HVD-02 · una nota puede cubrir más de su saldo | Alta | Emitir nota USD 100 y crear venta USD 150 enviando `creditNoteIds: [id, id]`. Aplica 150, no cobra los 50 restantes y deja saldo utilizable. Reproducción por API; no se confirmó un disparador desde la UI. | Corregido: IDs únicos antes de planificar aplicaciones. |
| HVD-03 · varios reclamos superan la cantidad vendida después de editarla | Alta | Vender 4 unidades; abrir dos reclamos de 2; editar venta a 2 unidades. Antes permite resolver ambos con importes pequeños dentro del límite económico, reponiendo unidades por encima de lo vendido. | Corregido: revalidación conjunta al resolver; HTTP 409 sin efectos hasta revisar/anular el reclamo sobrante. |
| HVD-04 · anular un reclamo resuelto hace reaparecer facturación | Alta | Vender USD 100 (costo 60), reintegrar 100 o emitir nota, anular el reclamo. Dashboard vuelve de 0 a 100 de facturación aunque el reintegro/nota y la reposición siguen vigentes. | Solo documentado: requiere decidir entre conservar reconocimiento financiero o revertir íntegramente caja, notas ya usadas, stock y cliente. Dos pruebas `it.fails` dejan ejecutable la expectativa pendiente; no está corregido. |

## Cierre del PR y CI

Continuación del 2026-11-02: PR #714 abierto, base `test`, head `qa/hunt-ventas-devoluciones`, sin conflictos. `gh pr checks 714` confirmó **8/8 checks aprobados** sobre `f7354fca4321c4c834d0a8e60c07b54165f1a036`: `changes`, `lint`, `backend-tests`, `frontend-unit (1)`, `frontend-unit (2)`, `pwa (android-chromium)`, `e2e (0)` y el agregador obligatorio `test`. Evidencia: [ejecución CI 41544769894](https://github.com/Matitisco/iManager/actions/runs/41544769894), completada el 2026-11-02 a las 23:29:44 UTC.

No había fallos de CI que corregir al retomar. Esta continuación completa documentación y el checklist de OpenSpec; no agrega cambios funcionales. El CI del PR selecciona pruebas a partir del diff completo y ejecutó cinco E2E smoke y dos controles PWA Android Chromium. Esos jobs no equivalen a repetir los 30 recorridos exploratorios locales ni certifican WebKit. El recorrido específico `e2e/hunt-ventas-devoluciones.spec.ts` no tiene `@smoke`: su evidencia corresponde a la ejecución local registrada abajo. El estado del último push se consulta con `gh pr checks 714` en el [PR #714](https://github.com/Matitisco/iManager/pull/714).

**Estado de bugs:** HVD-01, HVD-02 y HVD-03 corregidos en `1e5165e`, con regresiones; HVD-04 permanece **abierto, severidad alta, sin fix**. Los dos `it.fails` de HVD-04 pasan cuando se reproduce el defecto esperado; no son evidencia de corrección. Para reproducirlo por API local, resolver un reclamo con `POST /api/returns/:id/resolve` (reintegro o nota), consultar `GET /api/reports/overview?rangeKey=all_time`, anular con `DELETE /api/returns/:id` y volver a consultar el overview. La facturación no debería recuperar USD 100 mientras siga vigente la compensación. La regresión también comprueba que stock y acumulado del cliente mantienen los efectos de la devolución y que el reintegro o la nota siguen existiendo.

Entrega únicamente en la rama del PR, sin merge. #691 sigue presente en la historia y este PR no modifica sus permisos temporales de STAFF. Esta continuación no ejecutó build, servicios de aplicación, comandos Railway ni acceso a bases de datos; solo inspección de Git/CI, TypeScript y documentación.

## Pruebas y evidencia

- Regresiones: `backend/src/test/qa-hunt-ventas-devoluciones.integration.test.ts`. La primera corrida sobre la base produjo seis fallos para HVD-01/02/03; luego se amplió a ocho combinaciones de moneda/tipo de compensación, cuenta explícita/heredada y cotización actual distinta de la histórica, más rollback sin cotización.
- Navegador: `e2e/hunt-ventas-devoluciones.spec.ts`, devolución parcial USD con cuenta ARS en 1440 y 390 px, persistencia tras recarga, stock, facturación, margen y errores de página.
- TypeScript frontend/backend aprobado; 1061 unitarias backend, 154 integraciones aprobadas y 2 fallos esperados documentados (19 archivos), 79 pruebas frontend relacionadas aprobadas (9 archivos). Regresión final aislada: 11 aprobadas y 2 fallos esperados.
- Navegador: 30 recorridos distintos aprobados entre rondas, con un worker: ventas, cantidades/monedas, devolución parcial, permisos OWNER/STAFF, restauración/anulación y onboarding (incluido Excel). Las repeticiones finales completaron 19 recorridos y luego 4 controles (incluyen un recorrido ya aprobado). Se actualizan expectativas preexistentes de “Ganancia total”, cero ventas y dos registros con tres unidades en onboarding; restauración/anulación móvil usa el botón visible “Más acciones” para evitar eventos sintéticos de pulsación larga. No se cambió la UI para acomodar los tests.
- Chromium en 1440/390/360 px y emulación de iPhone. WebKit no se pudo ejecutar: faltan bibliotecas del sistema y la instalación de dependencias falló por acceso al repositorio de paquetes. Los dos controles de anulación configurados para WebKit se aprobaron con un config temporal que fija Chromium; no se certifica Safari.
- Los dos fallos esperados de HVD-04 se reportan separadamente de las pruebas aprobadas. La suite verde no significa que ese bug esté resuelto.

## Entorno y alcance

PostgreSQL nuevo y exclusivo en `127.0.0.1:55477`, bases `qa_hunt_ventas_test` (integraciones) y `qa_hunt_ventas_e2e` (navegador). Frontend Vite local y API con autenticación de test. Sin build, deploy, migraciones, producción ni comandos Railway. #691 conserva STAFF con costos y ganancias.

Se revisaron transacciones de ventas/reclamos, cantidades, moneda, límites económicos y permisos. Los recorridos/suites cubren ventas a cuenta, anulaciones, restauración, importaciones y onboarding según el detalle de validación. No se certifica toda la app ni se modifican datos históricos para reparar acumulados ya afectados.

Las primeras corridas amplias de frontend/integraciones/E2E se interrumpieron por saturación compartida (load average >200 y timeouts). No se presentan como aprobadas ni como bugs confirmados; se repiten los recorridos relevantes con concurrencia acotada.

Para reproducir las regresiones, con esa base local ya sincronizada:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55477/qa_hunt_ventas_test npm --prefix backend run test:integration -- qa-hunt-ventas-devoluciones
DATABASE_URL=postgresql://postgres@127.0.0.1:55477/qa_hunt_ventas_e2e PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4187 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3187 npx playwright test e2e/hunt-ventas-devoluciones.spec.ts --workers=1
```
