# Filtros de inventario legibles (#449)

## Reproducción y versión

- Fecha: 21/10/2026. HEAD y `origin/main`: `9b30ecf277783ef9a1ccf69f723772262a479612`, con #447 y #448 incluidos.
- Se reprodujo el código original de main en un fixture del componente real, con doce equipos sintéticos. La regla global `.chk { width: 18px; height: 18px; flex: none }` también alcanza los labels del panel. Antes del cambio, cada etiqueta mide 18 px de ancho; los textos largos se superponen a opciones/secciones siguientes.
- Consulta HTTP de solo lectura, con `Cache-Control: no-cache`, a `https://app.imanager.com.ar/version.json`: `buildId=60658746e56ddaa2`. HTML servido: `index-9zHD6QKo.js` y `index-DxBvOjBy.css`. El CSS servido conserva tanto `.inv-checks .chk` sin dimensiones como la regla global de 18×18; el defecto sigue presente. El buildId no identifica por sí mismo un commit.
- No hubo sesión autenticada productiva para recorrer el panel servido. La evidencia funcional corresponde al código de main y al cambio local con contexto sintético. HTTP no usa caché de navegador ni service worker; las pruebas abren contextos nuevos sin PWA.

## Cambio

Las opciones del panel tienen ancho completo, texto flexible, altura automática y blanco táctil de al menos 44 px. Se mantiene el checkbox dentro de su label: pulsar cualquier parte del texto lo selecciona. La corrección de dimensiones está limitada a `.inv-filter-sheet .inv-checks .chk`; no modifica `.chk` global, otros formularios ni el Sheet compartido.

El recorrido es Para completar, Estado, Condición, Calidad, Batería, Precio y Color. Los colores se pliegan inicialmente cuando hay más de seis; su buscador ignora mayúsculas/acentos al buscar y conserva exactamente cada valor al seleccionar. Por ejemplo, `Azul océano / Plata` y `AZUL OCEANO / PLATA` siguen siendo dos filtros diferentes. Una búsqueda sin coincidencias muestra un aviso; borrar la búsqueda recupera todas las opciones y conserva las selecciones.

Se muestra la cantidad de grupos seleccionados del borrador y de colores seleccionados. El indicador vigente y el total de resultados de Inventario mantienen su comportamiento. Limpiar solo vacía el borrador; el texto explica que requiere Aplicar. Cerrar con X, Escape o fondo descarta los cambios. Reabrir restaura los filtros vigentes y reinicia la búsqueda. Aplicar confirma y conserva el reset de paginación existente.

Sin cambios de API, permisos, AppContext, Prisma, datos guardados ni reglas de coincidencia. El panel no hace solicitudes propias ni introduce estados nuevos de error de red.

## Validación reproducible

| Comando | Resultado |
| --- | --- |
| `npm run test:frontend -- --maxWorkers=2` | 156 archivos, 1119 pruebas aprobadas |
| `npm --prefix backend run test:unit -- --maxWorkers=2` | 76 archivos, 516 pruebas aprobadas |
| `npm --prefix backend run test:integration` | 39 archivos, 322 pruebas aprobadas en la segunda corrida completa |
| `npm run lint` y `npm --prefix backend run lint` en paralelo | Ambos aprobados |
| `npx vitest run src/desk/screens/InventoryScreen.test.tsx src/desk/inventory-filters.test.ts --maxWorkers=2` | 31 pruebas aprobadas |
| `node scripts/test-inventory-filter-panel.mjs` | Cuatro viewports aprobados |

Las regresiones cubren selección desde etiquetas completas, valores históricos/compuestos separados, búsqueda sin coincidencias y recuperación de opciones, selección conservada, resultados confirmados, limpiar/aplicar y restauración tras cerrar por los tres métodos.

La primera ejecución de integración completó 321/322 casos: un `40P01` al ejecutar el TRUNCATE de `resetDatabase`, antes de un caso de onboarding. La segunda corrida completa, sin otras suites concurrentes, aprobó 322/322. No se modifican los helpers ni el comportamiento del backend para este arreglo de layout.

El script visual ejecuta el componente real con contexto sintético, sin backend, DB ni despliegue de la app. Vite sirve exclusivamente el fixture temporal y lo elimina al finalizar. En escritorio agrega un disparador oculto solo al fixture para ejercitar el mismo panel móvil; la UI desktop real conserva sus filtros por columna. Verifica anchuras de las etiquetas, contención del texto, blancos táctiles, ausencia de overflow horizontal, footer dentro del viewport, recorrido hasta el último color, selecciones combinadas y totales. También cubre stock vacío y carga de listas. La búsqueda es local y no tiene un estado de error de red propio.

La integración usa exclusivamente `DATABASE_URL` apuntando a `127.0.0.1:5432/imanager_test`. No se ejecutó un build ni la suite E2E completa que despliega la app; las pruebas visuales son automatizadas y aisladas. No hubo commit, push, nuevas ramas ni operaciones productivas.

## Evidencia visual sintética

| Estado | 320×844 | 390×844 | 1440×900 | 1536×640 |
| --- | --- | --- | --- | --- |
| Antes, main original | [Captura](before-320.png) | [Captura](before-390.png) | [Captura](before-1440.png) | [Captura](before-1536.png) |
| Después, apertura | [Captura](after-320.png) | [Captura](after-390.png) | [Captura](after-1440.png) | [Captura](after-1536.png) |
| Batería/precio antes de colores | [Captura](frequent-320.png) | [Captura](frequent-390.png) | [Captura](frequent-1440.png) | [Captura](frequent-1536.png) |
| Colores al final del scroll | [Captura](colors-320.png) | [Captura](colors-390.png) | [Captura](colors-1440.png) | [Captura](colors-1536.png) |
| Stock vacío | [Captura](empty-320.png) | [Captura](empty-390.png) | [Captura](empty-1440.png) | [Captura](empty-1536.png) |

Capturas Chromium con viewport emulado y fuentes de sistema (recursos externos bloqueados). No acreditan un iPhone físico ni Safari/PWA. Se espera el final de las animaciones de apertura y se completan las transiciones al capturar.

Contrato previo e implementación: [OpenSpec](../../openspec/changes/fix-inventory-filter-layout-449/design.md).
