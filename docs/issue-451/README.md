# Reportes — issue #451

Implementado en `fix/451-reportes`. Validación retomada el 21/10/2026 en `1f4123343e653d0c062599d4407595a940980f60`, después del merge de `origin/main` (`f889b830b32e40b29fb95bc9418d90de34ad008f`, incluida la navegación de #450). Las correcciones finales y la evidencia regenerada quedan en el working tree. En esta revisión no se hizo build, commit, push, rama nueva, PR, despliegue ni cambios de Prisma.

## Resultado

- Períodos propios de Reportes: 7, 30 y 90 días exactos, 12 meses móviles, Este mes y Personalizado inclusivo. Comparación inmediatamente anterior de igual cantidad de días calendario; hasta doce barras contiguas. Los ejemplos de 21 y 30 días usan barras de tres días.
- Indicadores con flecha, texto y tono semántico: importes verdes/rojos; Stock, Canjes y nuevos clientes neutrales. Sin porcentajes inventados cuando falta base o cotización; dirección conservada por debajo de 1 %.
- Ventas conserva su elegibilidad y sus cancelaciones en detalle/CSV, identificadas como excluidas de totales. El desglose consulta el inventario autorizado completo, incluido stock anterior al rango. Resultado del negocio solo para propietario, debajo de gráficos, con los cálculos existentes de ventas, gastos y devoluciones.
- Stock separa cohorte de ingresos, disponibles hoy, valor de venta actual y duraciones medibles vinculadas a ventas. Servicio separa presupuestos de cobros, contempla estimaciones cero, informa órdenes sin presupuesto y mide entregas únicamente con eventos válidos, con promedio decimal. Su evolución cuenta órdenes.
- Comisiones usa mes calendario independiente en la zona de la tienda, `from === to`, comparación separada del mes anterior y representación con signo cuando hay ajustes negativos. CSV respeta la categoría visible y conserva monedas originales.
- Disponibilidad por módulo distingue carga, error, éxito y permiso. Una actualización en segundo plano conserva el reporte confirmado y sus controles abiertos; si falla, muestra el error y bloquea la exportación hasta recuperarse. Reintentos, caché, cambios de tienda y respuestas obsoletas conservan las guardas de #461. Clientes no presenta compras como cero sin permiso/datos de Ventas.

No se modificaron Dashboard, banner de instalación, Más, navegación inferior móvil, SalesScreen, `format.ts`, `net-profit.ts` ni código productivo del backend.

## Evidencia inicial de main y despliegue

Antes de implementar, `git ls-remote origin refs/heads/main` devolvió `8115347807f50d8379a6a13205dd3ac4d40e1253`, igual a la base del worktree. HTTP de solo lectura a `https://app.imanager.com.ar/version.json?issue=451-20261021`, con `Cache-Control: no-cache`, devolvió `buildId=60658746e56ddaa2`; el HTML sirvió `index-9zHD6QKo.js` e `index-DxBvOjBy.css`. El buildId no identifica por sí mismo un commit. No se comprobó una sesión autenticada productiva ni se usaron datos de una tienda real.

Las capturas `before-*` ejecutan el código original extraído con `git archive` en `/tmp/451-before`, con las mismas fixtures sintéticas. No son wireframes ni capturas del despliegue. `after-*` ejecuta el código implementado.

## Validación

| Comando | Resultado |
|---|---|
| `npm run test:frontend` | 1.213 pruebas, 160 archivos, aprobados |
| `npm run test:backend:unit` | 520 pruebas, 76 archivos, aprobados |
| `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test npm run test:backend:integration` | 363 pruebas, 40 archivos, aprobados |
| `npm run lint` | TypeScript/lint frontend aprobado |
| `npm --prefix backend run lint` | TypeScript/lint backend aprobado |
| `npx playwright test --config e2e/451-shots.config.ts` | 17 escenarios funcionales/visuales aprobados, Chromium |
| Regresiones existentes de Reportes | 9 escenarios Chromium y 6 WebKit aprobados sobre el código final, sin retries |
| Selector iPhone `--repeat-each=5 --max-failures=1` | 5 repeticiones consecutivas aprobadas, sin retries |
| `openspec validate fix-report-semantics-451 --strict` | Aprobado |
| `git diff --check` | Aprobado |

Las suites que utilizan base de datos se ejecutaron secuencialmente, exclusivamente contra PostgreSQL local `imanager_test`. En este entorno reanudado no había servidor PostgreSQL: se inició una instancia aislada en `/tmp/451-postgres-data`, escuchando únicamente en `127.0.0.1:5432`, y se sincronizó su base vacía sin pérdida de datos. El setup E2E confirmó luego que ya estaba sincronizada con el schema. Las pruebas del backend verifican permisos combinados, mes exacto, rangos invertidos, aislamiento por tienda y proyecciones históricas existentes.

La primera ejecución de esta revisión no pudo iniciar las suites porque faltaban `node_modules`, Prisma Client y los navegadores. Se restauraron desde los lockfiles y se usó Node 22.23.3. Tras instalar Chromium, la suite frontend completa aprobó las 1.212 pruebas. El chequeo de tipos detectó `reducedMotion` fuera de `contextOptions` en la prueba de iPhone; se corrigió la configuración sin cambiar el selector de la aplicación. Los comandos se ejecutaron con cachés escribibles en `/tmp`, incluyendo `PLAYWRIGHT_BROWSERS_PATH=/tmp/451-browser-cache` para la suite frontend y las capturas.

La traza de WebKit identificó además una regresión de disponibilidad: un refresh por foco cambiaba un módulo confirmado a carga inicial y desmontaba el selector durante su reapertura. `store-records` ahora conserva el éxito mientras esa petición está pendiente, únicamente dentro del mismo ámbito; un fallo sigue mostrando error y un reintento espera una nueva respuesta exitosa. La regresión unitaria verifica esos estados con una petición diferida. El escenario de iPhone descarta el aviso de instalación mediante almacenamiento de prueba y espera posición/foco en cada apertura, conservando todas las aserciones y sin forzar clics. El cierre externo consume clics de compatibilidad durante 400 ms; la última reapertura se hace con Enter y comprueba el cierre con Escape y la devolución del foco.

Durante la implementación inicial se actualizaron etiquetas/expectativas anteriores, se agregó la respuesta de health a la fixture, se seleccionó la leyenda para evitar que el centro geométrico de una porción SVG cayera fuera del trazo, y se corrigió la tipificación del rango de buckets. La validación final de esta revisión usa el código ya integrado con main.

## Capturas y fixtures

Se regeneraron las 46 imágenes `after-*` sobre la revisión con el merge, manteniendo las 22 imágenes `before-*` originales. Playwright 1.59.1; Chromium 147.0.7727.15. Reloj fijo `2026-10-21T15:00:00Z`, idioma `es-AR`, zona `America/Argentina/Buenos_Aires`. Se espera carga y fuentes; las capturas completan/desactivan animaciones. Los importes y conteos son sintéticos y coherentes entre sí; no pretenden reproducir los números ilustrativos de los wireframes.

Todas las llamadas de negocio se interceptan. Se simulan sesión, listas, gastos, devoluciones, comisiones y cambio; los endpoints no previstos fallan y la prueba exige que no haya ninguno. Vite se ejecuta sin backend ni setup de DB. El estado de instalación se descarta solo en almacenamiento de prueba.

`451-shots.spec.ts` y `451-reports.spec.ts` se ejecutan exclusivamente mediante `451-shots.config.ts`, con su zona horaria y servidor controlados; se excluyen del descubrimiento del runner general, igual que las otras suites dedicadas de capturas. Se verificó el descubrimiento de ambos runners y la conservación de los 17 escenarios dedicados.

| Estado | 390×844 | 1440×900 |
|---|---|---|
| Ventas | [antes](before-ventas-390.png) · [después](after-ventas-390.png) | [antes](before-ventas-1440.png) · [después](after-ventas-1440.png) |
| Stock | [antes](before-stock-390.png) · [después](after-stock-390.png) | [antes](before-stock-1440.png) · [después](after-stock-1440.png) |
| Servicio | [antes](before-servicio-390.png) · [después](after-servicio-390.png) | [antes](before-servicio-1440.png) · [después](after-servicio-1440.png) |
| Personalizado aplicado | [antes](before-custom-applied-390.png) · [después](after-custom-applied-390.png) | [antes](before-custom-applied-1440.png) · [después](after-custom-applied-1440.png) |
| Editor personalizado | [antes](before-custom-editor-390.png) · [después](after-custom-editor-390.png) | [antes](before-custom-editor-1440.png) · [después](after-custom-editor-1440.png) |
| Canjes vacío | [antes](before-canjes-empty-390.png) · [después](after-canjes-empty-390.png) | [antes](before-canjes-empty-1440.png) · [después](after-canjes-empty-1440.png) |
| Clientes | [antes](before-clientes-390.png) · [después](after-clientes-390.png) | [antes](before-clientes-1440.png) · [después](after-clientes-1440.png) |
| Comisiones | [antes](before-comisiones-390.png) · [después](after-comisiones-390.png) | [antes](before-comisiones-1440.png) · [después](after-comisiones-1440.png) |
| Cargando | [antes](before-loading-390.png) · [después](after-loading-390.png) | [antes](before-loading-1440.png) · [después](after-loading-1440.png) |
| Error | [antes](before-error-390.png) · [después](after-error-390.png) | [antes](before-error-1440.png) · [después](after-error-1440.png) |
| Cotización no disponible | [antes](before-unavailable-390.png) · [después](after-unavailable-390.png) | [antes](before-unavailable-1440.png) · [después](after-unavailable-1440.png) |
| Variaciones | [fixture](after-deltas-390.png) · [parte inferior](after-deltas-lower-390.png) | [fixture](after-deltas-1440.png) |
| Ajustes negativos | [captura](after-comisiones-signed-390.png) | [captura](after-comisiones-signed-1440.png) |

La fixture de variaciones usa el componente real en `e2e/451-deltas.html`; no agrega una ruta de aplicación. Cubre suba, baja, conteo neutral, igualdad, base cero, conversión ausente y cambio menor a 1 %.

Las capturas móviles `*-evolution-*`, `*-breakdown-*`, `after-ventas-business-390.png` y `after-ventas-details-390.png` desplazan el contenedor interno `.stage` manteniendo el viewport. No se depende de `fullPage`. [Calendario de 320 px](after-calendar-320x844.png), [chips de 320 px](after-fit-320x844.png) y [calendario en 1536×640](after-calendar-1536x640.png) comprueban accesibilidad y límites del editor sin cambiar su geometría.

El inventario tiene 18 ingresos, 5 vendidos, 2 reservados y 11 disponibles en esa cohorte; el snapshot total incluye 41 disponibles. Servicio tiene 14 órdenes, 11 presupuestadas, 3 sin presupuesto, 9 entregadas y 3,2 días medibles. Los desgloses personalizados suman su propio total. Comisiones respeta ajustes y cotizaciones históricas en las proyecciones simuladas. [screenshots.json](screenshots.json) registra archivo, escenario, dimensiones, navegador, revisión y SHA-256.

## Reproducción

Desde la raíz, sin backend ni base:

```bash
npx playwright test --config e2e/451-shots.config.ts
```

Para recrear la base en una carpeta temporal, sin checkout ni rama:

```bash
mkdir -p /tmp/451-before

git archive 8115347 src public scripts index.html vite.config.ts package.json tsconfig.json firebase-applet-config.json backend/src/lib/inventory-models.ts backend/src/modules/admin/test-stores.ts | tar -x -C /tmp/451-before

ln -s /workspace/imanager-451/node_modules /tmp/451-before/node_modules
mkdir -p /tmp/451-before/e2e/pwa
cp e2e/451-fixtures.ts e2e/451-shots.spec.ts e2e/451-shots.config.ts /tmp/451-before/e2e/
cp e2e/pwa/fixtures.mjs /tmp/451-before/e2e/pwa/
REPORT_SHOT_PHASE=before npx playwright test --config /tmp/451-before/e2e/451-shots.config.ts --grep 'reports evidence|loading evidence|error evidence|unavailable evidence'
```

Regresiones existentes con backend local, después de integración:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test \
PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4512 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3512 \
npm run test:e2e -- e2e/mobile-reports.spec.ts e2e/report-period-right.spec.ts e2e/report-dropdown.spec.ts e2e/report-donut-fit.spec.ts e2e/staff-reports-permission.spec.ts --grep-invert iPhone --workers=1
```

## WebKit en este entorno

WebKit 26.4 se instaló en `/tmp/451-browser-cache`. Se descargaron las bibliotecas faltantes desde Debian y extrajeron exclusivamente en `/tmp/451-webkit-deps/root`; se copió el navegador a `/tmp/451-browsers`, sin modificar el cache instalado. El wrapper de esa copia conserva `LD_LIBRARY_PATH`. El script también admite contenedores sin índices de apt y respeta `PLAYWRIGHT_BROWSERS_PATH` al localizar el navegador original.

En este entorno, WPE headless aborta al crear la página con `EGL_NOT_INITIALIZED` y una aserción de `wpebackend-fdo`. GTK pudo abrir y renderizar la página; las regresiones WebKit se ejecutan con `--headed` sobre una pantalla virtual dedicada, iniciada con `Xvfb :451 -screen 0 1536x1000x24 -nolisten tcp -ac`. La validación de host basada en `ldconfig` no ve las bibliotecas privadas; se comprueba el navegador real con ellas.

El intento conjunto con interfaz gráfica sobre la pantalla compartida se interrumpió tras un timeout de estabilidad al pulsar el login de Chromium. La ejecución definitiva separa Chromium headless y WebKit GTK, manteniendo el backend local y las suites de base de datos secuenciales.

Esta copia de GTK no cargó recursos HTTPS externos por falta de soporte TLS, por lo que sus comprobaciones de texto usaron la tipografía alternativa del CSS. Las APIs del recorrido son locales y las cotizaciones se simulan. Las capturas aprobadas se generan por separado con Chromium.

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/451-browsers \
DISPLAY=:451 \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
LIBGL_ALWAYS_SOFTWARE=1 \
__EGL_VENDOR_LIBRARY_FILENAMES=/tmp/451-webkit-deps/root/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LD_LIBRARY_PATH=/tmp/451-webkit-deps/root/usr/lib/x86_64-linux-gnu \
XDG_CACHE_HOME=/tmp/451-cache \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test \
PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4512 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3512 \
npm run test:e2e -- e2e/report-donut-fit.spec.ts e2e/report-period-right.spec.ts e2e/report-dropdown-iphone.spec.ts --grep iPhone --workers=1 --headed
```

La fixture repetitiva de medición de texto usa movimiento reducido; el escenario independiente de selector conserva sus comprobaciones de teclado, foco y cierre. Para preparar las dependencias privadas de este entorno: `PLAYWRIGHT_BROWSERS_PATH=/tmp/451-browser-cache bash docs/issue-451/setup-webkit.sh`. El script verifica SHA-256 contra los metadatos de Debian y solo escribe en `/tmp`.

El selector aprobado también se ejecuta con el mismo entorno agregando `--repeat-each=5 --max-failures=1` y seleccionando solo `e2e/report-dropdown-iphone.spec.ts`. Las cinco repeticiones consecutivas aprobaron sin retries.

## Revisión de los fallos de CI — 22/10/2026

Revisión sobre `cbabeb0836e0c42a919c2b42e31cf1ff06e7c4c5`, comparada con `origin/main` en `f889b830b32e40b29fb95bc9418d90de34ad008f`. Se consultaron los logs completos de los runs [pull request 39697637557](https://github.com/Matitisco/iManager/actions/runs/39697637557) y [push 39697630509](https://github.com/Matitisco/iManager/actions/runs/39697630509). No hay un `P2034` registrado en ninguno de los dos logs.

| Caso | Clasificación y evidencia | Cambio |
|---|---|---|
| Comisiones, Pixel 5 / iPhone 13 / desktop | Expectativa desactualizada por el diseño aprobado de #451: el título ya no dice «últimos 30 días». OpenSpec exige un mes calendario independiente y comparación con el mes anterior. El fallo se reprodujo localmente en Chromium; el recorrido original de main pasó dos veces tanto en Android como en desktop. | Actualizado el test compartido para verificar el título, octubre de 2026, comparación con septiembre y dos peticiones con `from === to`, conservando la exportación y el resto del recorrido. |
| Escáner, 390 / 1440 | Preexistente e intermitente. Test, formulario, buffer y manejo de foco son idénticos a main. Sobre main se reprodujo el mismo `Proveedor: inactive` a 1440 con instrumentación pasiva del teclado: una pausa de 82 ms supera el umbral existente de 80 ms y reinicia el buffer. Tres de los cuatro recorridos normales pasaron. Una prueba temporal con reloj controlado confirmó a ambos anchos que una pausa de 100 ms conserva el IMEI pero no adelanta el foco; una ráfaga continua sí lo adelanta. Las cuatro repeticiones controladas pasaron. En el CI de push, 390 pasó al reintentar. | Sin cambios al escáner ni a sus tests; no se modificó el umbral para acomodar CI. |
| Caja iPhone, `cash-operations.flow.ts:172` | Intermitente durante el bootstrap, antes de crear la venta: `utils.ts:172` no encontró `sidebar-tab-inventory` después de recargar. Pasó al reintentar en el run de push y no falló en el de PR. Flujo, bootstrap, shell y backend involucrados no cambian respecto de main. Los dos ajustes, 80 y 130, pasaron localmente en la rama y en main; el caso exacto de 80 también aprobó una ejecución independiente de main. No se determinó la causa exacta del bootstrap de CI. | Sin cambios a Caja, sesión ni tests compartidos. |
| Detalle de venta desde Reportes, desktop-640 WebKit | El CI de PR registra un error interno de WebKit en `page.reload`, resuelto en el retry. Pasó localmente en la rama. | Sin cambios al test ni al detalle de venta. |

La comparación usa una extracción temporal de `git archive origin/main`, con dependencias enlazadas y puertos locales separados. La instrumentación del teclado y las pruebas de timing existen únicamente en `/tmp`; no forman parte del cambio. Solo se utilizó PostgreSQL en `127.0.0.1:5432/imanager_test`, ya sincronizado con el schema. No se modificó Prisma ni se ejecutó build, commit o push.

Validación de esta revisión:

- `npm run test:frontend`: **1.213 aprobadas**; `npm run test:backend:unit`: **520 aprobadas**.
- `npm run lint` y `npm --prefix backend run lint`: **aprobados**, repetidos después de actualizar el E2E; ambos ejecutan TypeScript sin emitir archivos.
- Chromium: **8 E2E aprobados sin retries** (`commissions.spec.ts`, `commissions-android.spec.ts`, `qa-scan-1910.spec.ts` y `qa-scan-1910-android.spec.ts`, filtrados por `navigation, seller|lector, duplicados`, con `--workers=1 --repeat-each=2`).
- Reportes: **5 escenarios aprobados** mediante `npx playwright test --config e2e/451-shots.config.ts e2e/451-reports.spec.ts`, incluidos 390 y 1440, calendario, filtros y exportación. Se restauraron las imágenes generadas: esta revisión no cambia capturas versionadas.
- WebKit GTK: **3 repeticiones aprobadas sin retries** de una prueba temporal del contrato de Reportes a 390×844: título, selector de octubre, comparación con septiembre, peticiones mensuales exactas y CSV con ambas monedas. Caja (80/130) y detalle desde Reportes también aprobaron en la rama.
- Comparación main: los cuatro recorridos originales de Comisiones Chromium aprobaron; el escáner tuvo tres aprobados y el mismo fallo de foco a 1440. Dos repeticiones de Caja 80/130 y detalle aprobaron. El tercer lote de esa ejecución terminó con SIGTERM, sin resultado, y no se cuenta como aprobado; la ejecución independiente posterior de Caja 80 terminó con código 0.

**Límite local de WebKit:** el recorrido largo de Comisiones no llegó a Reportes en GTK: el botón «Listo» de Lucía Díaz tiene un rectángulo visible, pero el hit test devuelve `<html>` y bloquea el clic. Una prueba mínima lo reproduce tanto en la rama como en main, incluso antes de tomar la captura; movimiento reducido, una pantalla virtual más grande y desactivar composición no lo resuelven. El contrato de Reportes se comprobó por separado; no se afirma que el recorrido largo completo de iPhone haya aprobado localmente. El fallo de CI sí llega al título de Reportes, por lo que es distinto de este bloqueo local. No se forzaron clics ni se alteraron los tests compartidos para sortearlo.
