# Reportes — issue #451

Implementado en `fix/451-reportes`, sobre `8115347807f50d8379a6a13205dd3ac4d40e1253`, con cambios en el working tree. Fecha de validación: 21/10/2026. Sin build, commit, push, rama nueva, PR, despliegue ni cambios de Prisma.

## Resultado

- Períodos propios de Reportes: 7, 30 y 90 días exactos, 12 meses móviles, Este mes y Personalizado inclusivo. Comparación inmediatamente anterior de igual cantidad de días calendario; hasta doce barras contiguas. Los ejemplos de 21 y 30 días usan barras de tres días.
- Indicadores con flecha, texto y tono semántico: importes verdes/rojos; Stock, Canjes y nuevos clientes neutrales. Sin porcentajes inventados cuando falta base o cotización; dirección conservada por debajo de 1 %.
- Ventas conserva su elegibilidad y sus cancelaciones en detalle/CSV, identificadas como excluidas de totales. El desglose consulta el inventario autorizado completo, incluido stock anterior al rango. Resultado del negocio solo para propietario, debajo de gráficos, con los cálculos existentes de ventas, gastos y devoluciones.
- Stock separa cohorte de ingresos, disponibles hoy, valor de venta actual y duraciones medibles vinculadas a ventas. Servicio separa presupuestos de cobros, contempla estimaciones cero, informa órdenes sin presupuesto y mide entregas únicamente con eventos válidos, con promedio decimal. Su evolución cuenta órdenes.
- Comisiones usa mes calendario independiente en la zona de la tienda, `from === to`, comparación separada del mes anterior y representación con signo cuando hay ajustes negativos. CSV respeta la categoría visible y conserva monedas originales.
- Disponibilidad por módulo distingue carga, error, éxito y permiso. Reintentos, caché, cambios de tienda y respuestas obsoletas conservan las guardas de #461. Clientes no presenta compras como cero sin permiso/datos de Ventas. Los informes no se exportan como vacíos tras un fallo de carga.

No se modificaron Dashboard, banner de instalación, Más, navegación inferior móvil, SalesScreen, `format.ts`, `net-profit.ts` ni código productivo del backend.

## Evidencia inicial de main y despliegue

Antes de implementar, `git ls-remote origin refs/heads/main` devolvió `8115347807f50d8379a6a13205dd3ac4d40e1253`, igual a la base del worktree. HTTP de solo lectura a `https://app.imanager.com.ar/version.json?issue=451-20261021`, con `Cache-Control: no-cache`, devolvió `buildId=60658746e56ddaa2`; el HTML sirvió `index-9zHD6QKo.js` e `index-DxBvOjBy.css`. El buildId no identifica por sí mismo un commit. No se comprobó una sesión autenticada productiva ni se usaron datos de una tienda real.

Las capturas `before-*` ejecutan el código original extraído con `git archive` en `/tmp/451-before`, con las mismas fixtures sintéticas. No son wireframes ni capturas del despliegue. `after-*` ejecuta el código implementado.

## Validación

| Comando | Resultado |
|---|---|
| `npm run test:frontend` | 1.203 pruebas, 159 archivos, aprobados |
| `npm run test:backend:unit` | 520 pruebas, 76 archivos, aprobados |
| `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test npm run test:backend:integration` | 363 pruebas, 40 archivos, aprobados |
| `npm run lint` | TypeScript/lint frontend aprobado |
| `npm --prefix backend run lint` | TypeScript/lint backend aprobado |
| `npx playwright test --config e2e/451-shots.config.ts` | 17 escenarios funcionales/visuales aprobados, Chromium |
| Regresiones existentes de Reportes | 9 escenarios Chromium aprobados; WebKit en ejecución separada |
| `openspec validate fix-report-semantics-451 --strict` | Aprobado |
| `git diff --check` | Aprobado |

Las suites que utilizan base de datos se ejecutaron secuencialmente, exclusivamente contra PostgreSQL local `imanager_test`. El setup E2E confirmó que ya estaba sincronizada con el schema. Las pruebas del backend verifican permisos combinados, mes exacto, rangos invertidos, aislamiento por tienda y proyecciones históricas existentes.

Los fallos intermedios se investigaron: se actualizaron etiquetas/expectativas anteriores, se agregó la respuesta de health a la fixture, se seleccionó la leyenda para evitar que el centro geométrico de una porción SVG cayera fuera del trazo, y se corrigió la tipificación del rango de buckets. Una corrida de frontend iniciada durante una edición cargó un módulo anterior; la corrida completa posterior, con fuentes estables, aprobó las 1.203 pruebas. WebKit inicialmente no arrancaba por bibliotecas ausentes; su preparación local se describe abajo.

## Capturas y fixtures

Playwright 1.59.1; Chromium 147.0.7727.15. Reloj fijo `2026-10-21T15:00:00Z`, idioma `es-AR`, zona `America/Argentina/Buenos_Aires`. Se espera carga y fuentes; las capturas completan/desactivan animaciones. Los importes y conteos son sintéticos y coherentes entre sí; no pretenden reproducir los números ilustrativos de los wireframes.

Todas las llamadas de negocio se interceptan. Se simulan sesión, listas, gastos, devoluciones, comisiones y cambio; los endpoints no previstos fallan y la prueba exige que no haya ninguno. Vite se ejecuta sin backend ni setup de DB. El estado de instalación se descarta solo en almacenamiento de prueba.

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
npm run test:e2e -- e2e/mobile-reports.spec.ts e2e/report-period-right.spec.ts e2e/report-dropdown.spec.ts e2e/report-dropdown-iphone.spec.ts e2e/report-donut-fit.spec.ts e2e/staff-reports-permission.spec.ts --workers=1
```

## WebKit en este entorno

El cache de WebKit 26.4 estaba presente, pero Debian 13 no tenía sus bibliotecas GTK/WPE/EGL. Se descargaron paquetes oficiales de Debian y extrajeron exclusivamente en `/tmp/451-webkit-deps/root`; se copió el navegador a `/tmp/451-browsers`, sin modificar el cache instalado. El wrapper de esa copia conserva `LD_LIBRARY_PATH`. Mesa se selecciona mediante su JSON de EGL y renderiza por software. La validación de host basada en `ldconfig` no ve bibliotecas privadas; el navegador real se prueba con ellas.

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/451-browsers \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
LIBGL_ALWAYS_SOFTWARE=1 \
__EGL_VENDOR_LIBRARY_FILENAMES=/tmp/451-webkit-deps/root/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LD_LIBRARY_PATH=/tmp/451-webkit-deps/root/usr/lib/x86_64-linux-gnu \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test \
PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4512 \
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3512 \
npm run test:e2e -- e2e/report-donut-fit.spec.ts e2e/report-period-right.spec.ts e2e/report-dropdown-iphone.spec.ts --grep iPhone --workers=1
```

La fixture repetitiva de medición de texto usa movimiento reducido; el escenario independiente de selector conserva sus comprobaciones de teclado, foco y cierre. Para preparar las dependencias privadas de este entorno: `bash docs/issue-451/setup-webkit.sh`. El script verifica SHA-256 contra los metadatos de Debian y solo escribe en `/tmp`.

La comprobación mínima de esa copia pudo abrir una página y renderizar texto. Resultado de los escenarios completos: pendiente de registrar.
