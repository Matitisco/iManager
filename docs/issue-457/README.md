# Issue #457 — Cajas, Gastos y Proveedores

Base local: `f889b830b32e40b29fb95bc9418d90de34ad008f`, igual a la referencia local `origin/main`. Trabajo sobre `fix/457-caja`, sin crear ramas, commits, push ni PR. OpenSpec: `finance-operation-administration-457` (artefactos preparados manualmente porque el binario no está instalado; sin archivar).

## Reproducción y versión pública

La base muestra Ingreso, Egreso, Convertir fondos, Contar y cerrar, Administrar caja y Ajustar saldo juntos. Las tarjetas sin sesiones dicen «Sin abrir» y los días de sesión usan ISO. Gastos explica que no mueve Caja sin ofrecer el paso siguiente; Proveedores prioriza cuatro acciones sobre contacto y compras.

Consulta HTTP pública de solo lectura, sin caché de navegador/PWA, el 21/10/2026 a las 22:49 de Argentina: `https://app.imanager.com.ar/version.json` devuelve `buildId=60658746e56ddaa2`. El HTML carga `/assets/index-9zHD6QKo.js`, SHA-256 `dca4253e024fd69d7f44b172d253644c1a50e9f547ae8b036cf76877049d79fa`. El bundle conserva «Sin abrir», «Abrí las cajas antes de cobrar» y «No mueve la caja». Registro en [deployment.json](deployment.json).

No se acredita un SHA de despliegue: el build ID no es un commit y la conexión de lectura de Railway exige reautenticación. Tampoco se operó una sesión productiva. La reproducción funcional y las imágenes usan el shell real local con API interceptada y datos ficticios.

## Implementación y diferencias aprobadas

- **Cajas:** una moneda y un medio por caja. Operación diaria, cierre principal, ingreso/egreso secundarios y conversión como enlace. Administración del dueño y cierres anteriores en columna secundaria; móvil conserva una columna con operación primero. Filtros plegables y paginación preservados. Cada formulario identifica caja, moneda y consecuencia; conversión conserva origen/destino, cotización y monto recibido.
- **Estados reales:** última sesión cerrada cuando no hay una abierta; ausencia de historial explícita si nunca hubo sesión. Abrir día solo después del día cerrado. Jornadas abiertas de días anteriores permiten contar y cerrar; no ofrecen movimientos que el backend rechazaría. SUBMITTED separa saldo, esperado, contado y diferencia; aprobación y pedido de reconteo solo para OWNER. RECOUNT mantiene conteo a ciegas.
- **Lecturas de caja:** fecha de apertura, nombre del responsable y fondo ya existente; nombres resueltos en lote, sin perfiles ni emails. Fondo y saldo sujetos a `cashBalances`. Fechas calendario locales y antigüedad de apertura en la zona de tienda. Los cobros siguen siendo opcionales respecto de Caja y no se trasladan movimientos históricos.
- **Gastos:** período mensual explícito, gastos/bruta/neta del endpoint existente `/api/reports/net-profit`. El resumen incluye gastos activos del mes; las categorías y Activos/Archivados filtran la lista, sin alterar el resumen. Importes originales con moneda y centavos; valores desconocidos como `—`, con explicación de carga/error/cotización. Notas como descripción, sin campo nuevo de concepto.
- **Formulario de gasto:** footer fijo, dos columnas en desktop y una en móvil, panel «Qué cambia», sin proyección de una ganancia neta futura. Archivados recuperados con la consulta existente y Restaurar disponible. Errores conservan borrador; guardar no llama a Caja.
- **Proveedores:** contacto disponible, equipos y última compra activa desde `StockPurchase`, agrupada por proveedor. Sin fila sintética «Particulares (canjes)». La ficha prioriza contacto, notas, origen y compras; conserva equipos sin lote, problemas y apertura de equipos. Costos protegidos por `canSeeFinancials`. Registrar equipo es principal, Subir stock secundario, Editar/Archivar en Más acciones; archivo/restauración conservan origen y compras.
- **Permisos y rutas:** Finanzas desaparece de sidebar, Más y chips para STAFF. Se conserva `sectionAllowed`, incluido acceso directo autorizado a Cajas y Proveedores. Proveedores sigue en Finanzas para los roles visibles; aliases antiguos y query strings permanecen.

### Límite gasto–egreso

`Expense` no tiene relación con `CashMovement` ni un escritor transaccional de egresos originados en gastos. Esta entrega explica: «Registrar un gasto reduce la ganancia neta. No registra una salida de dinero de caja. Si el pago salió de una caja, el egreso se registra por separado», con **Ir a Cajas**.

No se infieren asociaciones por fecha, importe, categoría o notas. No se muestran estados de pago, «Pagado fuera de caja» ni acciones de egreso por registro. **«Egreso registrado»** queda reservado para un vínculo verificable futuro, que requiere atomicidad, idempotencia, anulaciones y reglas de edición/archivo. No se creó ningún vínculo retroactivo, nuevo campo, migración, estado contable ni fórmula.

## Validación

Persistencia exclusivamente en `127.0.0.1:5434/imanager_test`, con `DATABASE_URL=postgresql://postgres@127.0.0.1:5434/imanager_test` explícita y host/puerto/base validados antes de ejecutar. `prisma db push --skip-generate` creó la base sin avisos de pérdida ni opciones destructivas. Integración y E2E con persistencia se ejecutan uno después del otro. La suite E2E usa cuatro workers con tiendas/cuentas únicas por prueba; no comparte los resets de integración.

```bash
export PLAYWRIGHT_BROWSERS_PATH=/workspace/imanager-457/node_modules/.cache/issue-457-browsers
export LD_LIBRARY_PATH=/workspace/imanager-457/node_modules/.cache/issue-457-libs/root/usr/lib/x86_64-linux-gnu
export GST_PLUGIN_PATH=/workspace/imanager-457/node_modules/.cache/issue-457-libs/root/usr/lib/x86_64-linux-gnu/gstreamer-1.0
export GST_REGISTRY=/workspace/imanager-457/node_modules/.cache/issue-457-libs/registry.bin
npm run lint
npm --prefix backend run lint
npm run test:frontend
DATABASE_URL=postgresql://postgres@127.0.0.1:5434/imanager_test MP_ACCESS_TOKEN= npm --prefix backend run test:unit
DATABASE_URL=postgresql://postgres@127.0.0.1:5434/imanager_test MP_ACCESS_TOKEN= npm --prefix backend run test:integration
DATABASE_URL=postgresql://postgres@127.0.0.1:5434/imanager_test MP_ACCESS_TOKEN= PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4196 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3196 npm run test:e2e -- --workers=4
npx playwright test --config e2e/issue-457-shots.config.ts
# Reejecución final de los dos specs corregidos/preparados: 9/9.
DATABASE_URL=postgresql://postgres@127.0.0.1:5434/imanager_test MP_ACCESS_TOKEN= PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:4196 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:3196 npm run test:e2e -- e2e/delete-cancelled-trade-ins.spec.ts e2e/qa-scan-1910-iphone.spec.ts --workers=1
```

Los scripts `lint` son los typechecks (`tsc --noEmit`); no hay linter separado. Sin build.

| Verificación | Resultado |
|---|---|
| Frontend completo | 1188 pruebas aprobadas, 161 archivos |
| Backend unitario completo | 516 pruebas aprobadas, 76 archivos |
| Backend integración completo | 365 pruebas aprobadas, 40 archivos |
| Typecheck/lint frontend y backend | Aprobados |
| Capturas antes y después | 2 recorridos por fase aprobados, 64 PNG |
| E2E general | 297 escenarios únicos verificados; 7 omisiones configuradas en el repo |

La primera ejecución E2E completa registró 290 aprobados, 7 omitidos, 5 fallos y 2 interrupciones por el límite de fallos. Tras corregir el acceso al menú del test móvil y preparar los plugins multimedia de WebKit, se reejecutaron ambos specs afectados secuencialmente: **9/9 aprobados**, incluidas todas las fallas/interrupciones. Dos de esos nueve ya habían pasado en la primera ejecución: cobertura final de 297 escenarios únicos, más las siete omisiones existentes. No se ocultaron fallas mediante nuevos skips ni se modificó el escáner de la aplicación.

Regresiones nuevas: estados/jerarquía/errores de Caja, fondo protegido, dueño frente a manager/empleado, fechas y zonas; resumen/filtros/importes de gastos sin estados de pago inventados; guardar/restaurar/error de gastos sin llamada a Caja; ficha de proveedores, compras sin lote, costos, archivo/restauración; navegación y rutas autorizadas. Las integraciones verifican lecturas entre tiendas y CRUD de gastos sin crear movimientos ni cambiar saldos.

WebKit no estaba instalado. Se descargaron Chromium/WebKit y las bibliotecas faltantes dentro de `node_modules/.cache/issue-457-*`, sin instalar paquetes del sistema ni modificar dependencias del proyecto. Esta máquina requiere `PLAYWRIGHT_BROWSERS_PATH=/workspace/imanager-457/node_modules/.cache/issue-457-browsers` y `LD_LIBRARY_PATH=/workspace/imanager-457/node_modules/.cache/issue-457-libs/root/usr/lib/x86_64-linux-gnu`. El escáner WebKit además requiere los plugins GStreamer base/good/bad/libav; el diagnóstico confirmó «appsink not found». Se extrajeron también dentro del repo y se usan `GST_PLUGIN_PATH=/workspace/imanager-457/node_modules/.cache/issue-457-libs/root/usr/lib/x86_64-linux-gnu/gstreamer-1.0` y `GST_REGISTRY=/workspace/imanager-457/node_modules/.cache/issue-457-libs/registry.bin`. Las capturas de Team de la suite existente se guardan ahora en `test-results/team-permissions/` para mantener todos los artefactos dentro del repo. La regresión de borrado móvil de canjes usa el botón visible Más acciones: el long press sintético podía cancelarse por el scroll inicial, antes de abrir el menú. Se mantienen las verificaciones de anulación, saldos/stock inalterados y persistencia; la cobertura de long press permanece en las suites de patrones móviles. La prueba de rol cacheado consulta el saludo dentro de `waitFor`, evitando afirmar sobre un nodo que ya reemplazó el render de confirmación de sesión; conserva los controles que prohíben consultas de comisiones de dueño.

## Evidencia visual

64 PNG sintéticos antes/después, 390×844 y 1440×900; modales de gasto y proveedor también a 1536×640. Reloj fijo 21/10/2026, cotización fija, fuentes listas y animaciones deshabilitadas. En desktop, las capturas «Más» muestran la navegación lateral porque esa ruta vuelve al Dashboard en ese tamaño, conforme al shell existente.

| Vista | Antes móvil | Después móvil | Antes desktop | Después desktop |
|---|---|---|---|---|
| Caja abierta | [Antes](before-caja-abierta-390x844.png) | [Después](after-caja-abierta-390x844.png) | [Antes](before-caja-abierta-1440x900.png) | [Después](after-caja-abierta-1440x900.png) |
| Cierre pendiente | [Antes](before-caja-esperando-390x844.png) | [Después](after-caja-esperando-390x844.png) | [Antes](before-caja-esperando-1440x900.png) | [Después](after-caja-esperando-1440x900.png) |
| Última cerrada | [Antes](before-caja-cerrada-390x844.png) | [Después](after-caja-cerrada-390x844.png) | [Antes](before-caja-cerrada-1440x900.png) | [Después](after-caja-cerrada-1440x900.png) |
| Gastos | [Antes](before-gastos-390x844.png) | [Después](after-gastos-390x844.png) | [Antes](before-gastos-1440x900.png) | [Después](after-gastos-1440x900.png) |
| Nuevo gasto | [Antes](before-gasto-nuevo-390x844.png) | [Después](after-gasto-nuevo-390x844.png) | [Antes](before-gasto-nuevo-1440x900.png) | [Después](after-gasto-nuevo-1440x900.png) |
| Proveedores | [Antes](before-proveedores-390x844.png) | [Después](after-proveedores-390x844.png) | [Antes](before-proveedores-1440x900.png) | [Después](after-proveedores-1440x900.png) |
| Ficha | [Antes](before-proveedor-detalle-390x844.png) | [Después](after-proveedor-detalle-390x844.png) | [Antes](before-proveedor-detalle-1440x900.png) | [Después](after-proveedor-detalle-1440x900.png) |

Otras muestras: reconteo, dueño/empleado, lista desplazada de Gastos, carga/vacío/error en Cajas y Gastos, vacío/error en Proveedores y [guardado fallido](after-gasto-error-guardado-390x844.png). [Gasto 1536×640](after-gasto-nuevo-1536x640.png), [Proveedor 1536×640](after-proveedor-detalle-1536x640.png).

Antes se sirvieron temporalmente los siete archivos de UI de `git show f889b83:<ruta>`, con copias preservadas y restauradas; mismo fixture y configuración. Para regenerar después, ejecutar `npx playwright test --config e2e/issue-457-shots.config.ts`. `ISSUE_457_PHASE=before` solo corresponde a los fuentes de esa base, no al árbol final.

Las capturas no usan backend, globalSetup de Prisma ni credenciales reales. Toda solicitud API no contemplada falla y hace fallar la prueba. La suite verifica cero escrituras al consultar/navegar/abrir/cancelar. El único POST adicional es un gasto simulado que falla deliberadamente: el borrador queda abierto y no hay llamadas a `/api/cash`. Se comprueba ausencia de overflow horizontal, footer y acciones alcanzables; inspección manual de móvil, desktop y ventanas bajas.
