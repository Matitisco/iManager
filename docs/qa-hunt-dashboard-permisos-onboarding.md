# QA exploratorio: dashboard, permisos y onboarding

Base inicial: `origin/test` (`e4fa2a9`); integrada después con `651df9a` (#715), rama `qa/hunt-dashboard-permisos-onboarding`. Datos ficticios; PostgreSQL exclusivamente en loopback, puerto 55461. No se consultaron bases de producción ni Railway, no se imprimieron secretos ni se hizo build. Se conserva #691: STAFF ve costos y finanzas; eso no concede Reportes ni acciones sensibles.

| Bug confirmado | Severidad | Cómo reproducir | Estado | PR |
| --- | --- | --- | --- | --- |
| HUNT-01. Dashboard reutiliza un reporte convertido con otra configuración monetaria. | Media | Registrar ventas USD con tienda ARS/cotización 1000; abrir dashboard, cambiar a USD/cotización 2000 en Configuración y volver. Mientras revalida, el snapshot anterior puede mostrar la mitad del importe. También falta reconsulta si cambia la configuración estando montado. | Corregido: caché y respuestas pendientes separadas por moneda/configuración. Tests antes del fix: cinco cambios de configuración y respuesta tardía; E2E 390/1440 con API demorada. | [#716](https://github.com/Matitisco/iManager/pull/716) |
| HUNT-02. Los KPIs financieros llevan a una sección denegada. | Baja | STAFF sin Reportes: tocar Ventas o Margen bruto desde dashboard abre acceso denegado. | Corregido: conserva los importes de #691 y sólo ofrece navegación si tiene Reportes. Regresión de componente y E2E 390/1440; costos visibles y anulación 403 comprobados. | [#716](https://github.com/Matitisco/iManager/pull/716) |
| HUNT-03. Primeros pasos da Equipo por listo con una invitación inválida. | Media | En una tienda nueva, invitar y revocar; recargar Primeros pasos sin otros miembros activos. También ocurre con invitaciones vencidas o aceptadas cuyo miembro fue eliminado. | Corregido: sólo cuentan invitaciones pendientes vigentes o miembros activos. Tres regresiones API antes del fix y E2E 390/1440. | [#716](https://github.com/Matitisco/iManager/pull/716) |
| HUNT-04. Cambiar el costo del remanente reescribe la ganancia histórica. | Alta | Tienda ARS/cotización 1000; stock de 20 a costo USD 450. Vender 10 por USD 6500: ganancia ARS 2.000.000. Cambiar el costo de las 10 restantes a USD 500: la ganancia anterior baja a ARS 1.500.000. | Comportamiento confirmado, sin fix; pendiente definir si editar un remanente debe corregir también el histórico. Preservar el costo original requiere snapshot de costo/moneda y criterio de migración para ventas/devoluciones existentes. E2E `documentado: editar el costo…` tiene falla esperada explícita; un error de preparación sigue fallando y un futuro fix produce pase inesperado. | [#716](https://github.com/Matitisco/iManager/pull/716) |
| HUNT-05. Empleado eliminado queda atrapado en onboarding. | Alta | Eliminar la única membresía STAFF; volver a ingresar y enviar un nombre de tienda. `/api/onboarding` respondía 200 pero seguía devolviendo tienda/membresía null y `onboardingRequired=true`. | Corregido: ambas verificaciones de membresía ignoran eliminadas. Regresión API roja/verde verifica OWNER en la tienda nueva, reintento idempotente e inaccesibilidad de la tienda anterior. | [#716](https://github.com/Matitisco/iManager/pull/716) |

## Validación y alcance

- Escenarios sintéticos: mayorista con cantidades >1, venta a cuenta, devoluciones parciales, anulaciones, OWNER/STAFF, cuenta sin tienda y Excel con duplicados/datos inválidos. No se usaron datos ni cuentas reales de Natan, Juan o iPh Concordia.
- Chromium 390×900 y 1440×900 para las regresiones nuevas; suites existentes de onboarding también usan sus viewports de teléfono/escritorio. Geometría sin scroll horizontal de página y capturas adjuntas a los tests; revisión visual local de las capturas indicadas por los recorridos.
- Los analizadores externos de texto/IA de las suites existentes usan respuestas controladas. El XLSX sintético pasa por análisis y persistencia reales en PostgreSQL local. No se afirma cobertura de proveedores externos.
- Mantenimiento de pruebas: dos aserciones antiguas contaban filas en vez de unidades de stock agrupadas; ahora verifican cantidades, precios y moneda. El E2E de STAFF se ajustó a #691. El recorrido móvil se ejecuta en Chromium; WebKit no tiene sus bibliotecas de sistema en este entorno y su suite original se conserva.
- Aislamiento: la suite amplia detectó que una credencial Resend heredada desviaba la prueba de SMTP ficticio al proveedor externo. Se desactiva explícitamente en el setup de tests y en el servidor QA; la prueba pasa con el SMTP local. No se imprimió la credencial.
- TypeScript frontend/backend y 150 pruebas frontend relacionadas aprobados. Backend: 1.061 unitarias y 69 integraciones relacionadas aprobadas. Las 788 pruebas de integración completas quedaron cubiertas: dos hooks de limpieza local agotaron el tiempo en la corrida amplia y sus dos archivos (24 pruebas) pasaron al repetirlos aisladamente; sin cambios para ampliar timeouts en la configuración del repositorio.
- E2E: 43 resultados esperados (42 casos normales y HUNT-04 como falla esperada explícita), con las pruebas de Excel, cambio de moneda, permisos y onboarding móvil/escritorio aprobadas. CI: consultar el check requerido `test` en el PR.

Reejecución: crear la base local vacía `qa_hunt_dashboard_e2e` en PostgreSQL 55461 y ejecutar:

```bash
npm run test:e2e -- --config e2e/hunt-dashboard-permisos-onboarding.config.ts
```

La configuración rechaza hosts no locales y otro nombre de base, aplica el schema sólo a esa base y arranca API/Vite locales (3186/4186). Nunca usarla con una base de negocio. La suite general omite los casos nuevos fuera de esta configuración dedicada.

Tests de regresión: `src/desk/screens/DashboardScreen.test.tsx`, `backend/src/test/getting-started.integration.test.ts`, `backend/src/test/auth-onboarding.integration.test.ts` y `e2e/hunt-dashboard-permisos-onboarding.spec.ts`. Evidencia generada en `test-results/` (fuera de git).

## Integración con `test` · 2026-11-03

Merge de `origin/test` en `f8874ee` (#717, incluye #718, #713 y #714) sobre `a92c5ae`, en la rama de #716. Los conflictos textuales estaban en `PROJECT_STATUS.md` y `e2e/onboarding-cases.ts`: se conservan ambas entradas de estado y se verifican conjuntamente dos registros, tres unidades, precios y moneda. El merge automático de Primeros pasos conserva tanto el filtro de invitaciones pendientes vigentes como `acquiredQuantity` para muestras.

La corrida conjunta detectó cuatro expectativas de #718 que aún permitían anular una devolución con reintegro. Se actualizan a HTTP 409 según #717, verificando que el reclamo y los totales del proveedor no cambien, y se mantiene la reventa del stock devuelto sin duplicar adquisiciones. Cuatro casos nuevos (importación/manual × OWNER/STAFF) comprueban además que anular un RMA sin compensación revierte el stock y conserva unidades adquiridas e inversión. No se cambia la lógica de negocio de ninguno de los PR integrados.

Validación local de esta integración:

- Lint TypeScript frontend/backend y chequeo TypeScript de los E2E afectados aprobados. El cliente Prisma local se regeneró para incluir el campo de #718.
- 271 pruebas frontend en 12 archivos y 1.061 unitarias backend en 107 archivos aprobadas.
- 198 integraciones únicas en 17 archivos aprobadas entre la corrida inicial y las repeticiones de proveedores, backfill y anulación; las expectativas incompatibles se corrigieron y los cuatro casos nuevos usan RMA/reparación, que es la resolución válida sin movimiento de dinero.
- Chromium 1440/390: 57 resultados esperados. Suite de #716: 43 (42 normales y HUNT-04 con la falla esperada ya documentada); inventario/proveedores: 12; devoluciones/anulación compensada: 2. Ambos conflictos de onboarding se ejercitan en navegador. Configuración temporal fuera del repo para devoluciones, con puertos locales 3198/4198 y su base exclusiva.
- PostgreSQL nuevo y exclusivo en `127.0.0.1:55497`: `qa_merge_716`, `qa_hunt_dashboard_e2e`, `qa_hunt_inventario_compras_e2e` y `qa_merge_716_returns_e2e`. Procesos de validación con entorno limpio y datos ficticios; no se consultaron secretos, Railway ni producción, ni se hizo build.
