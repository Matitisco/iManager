# #374 — Navegación de Resumen periódico

Parte de #374. El reporte que se veía dentro de Reportes figura en la aplicación como **Resumen periódico**. Se conserva ese nombre y el contenido existente.

## Causa y corrección

`ReportsScreen` construía su propia fila de pestañas y agregaba el resumen mediante un estado local. Al abrir Historial o Comisiones, `GroupTabs` reconstruía los enlaces desde `pageTabs`, donde ese destino no existía. Al desmontar Reportes, también desaparecía la selección del resumen.

El destino `periodicSummary` ahora integra el registro compartido de Análisis y tiene la ruta `#/analisis/resumen-periodico`. `ReportsScreen` usa `GroupTabs` y decide su contenido desde la ruta del escritorio. El permiso es exactamente Reportes, tanto en los enlaces como al entrar por URL. No se agrega un permiso independiente.

Se reutilizan `wchips nav-tabs`, `sg` y `periodic-report-tabs`; no hay colores, tokens, subtítulos, componentes ni estados de carga nuevos. El único CSS aditivo evita comprimir/partir las pestañas de Historial móvil: conserva el segmentado y permite desplazarlo horizontalmente. El contenido de las pantallas, API, schema y scheduler SMTP no cambian.

## Reproducción y capturas

App real en web 4400/API 3400; PostgreSQL falso `imanager_reportenav` en localhost:5433. Login de prueba `dueno@imanager.local`. Seeds de ejemplo de la copia local, sin datos productivos.

Evidencia externa: `/workspace/qa-reporte-nav/`.

- `antes/`: 48 PNG, origen/destino de las doce transiciones dirigidas entre Reportes, Comisiones, Historial y Resumen periódico, a 1440×900 @1x y 390×844 @2x. Las cuatro transiciones desde Comisiones/Historial hacia el resumen quedan registradas como `bloqueado`.
- `despues/`: las mismas 48 capturas, seis adicionales de recarga/Atrás/Adelante y cuatro de la hoja real de ventas (inicio/final del scroll). La fila móvil de Historial conserva una línea.
- `antes/resultados.json`, `despues/resultados.json`: matriz completa; después, 24/24 transiciones disponibles, selección exclusiva, ruta correcta, sin overflow horizontal ni errores de JavaScript.
- `transitions.mjs`, `modal.mjs`: scripts Playwright, Chrome `/usr/bin/google-chrome`, argumento `--no-sandbox`. La hoja queda dentro del viewport y Escape devuelve al resumen sin cambiar la ruta.

Se revisaron las capturas de cada pantalla y los estados de navegación/restauración en ambos tamaños. Los datos comerciales son exclusivamente ejemplos del seed local.

## Pruebas

- TypeScript/lint frontend y backend: aprobados (`tsc --noEmit`). No se ejecutó build.
- Vitest de los ocho archivos relacionados: **169/169** aprobados. Incluye las doce transiciones dentro de `DeskApp` en ambos layouts, selección/contenido, remontaje de la ruta y autorización directa con/sin Reportes.
- Unitarios backend completos: **606/606** aprobados.
- Integración del endpoint existente de resumen periódico: **7/7** aprobadas, DB falsa separada `imanager_reportenav_test`.
- Reintentos aislados de pruebas ajenas con timeout: badges 1/1, store-records y operation-form-layout 37/37; Caja/reintegros 55/55.

La corrida frontend completa superó cinco minutos, sufrió pausas de varios minutos y se interrumpió; sus dos archivos con timeout pasaron aislados. La primera integración completa agotó las conexiones del Postgres compartido. Con `connection_limit=5`, aprobó 409/412; dos timeouts pasaron aislados. Persiste localmente una expectativa ajena de `repair-history.integration.test.ts`, que espera `repair-event:old-2` y recibe tres eventos. El árbol backend es idéntico a `origin/main`; no se modifica ese módulo ni se presenta la integración global local como aprobada. El CI del PR verifica las suites completas antes del merge.

No se agrega un E2E persistente: la regresión queda en integración de componentes y la evidencia visual usa navegación real con la API/DB local.
