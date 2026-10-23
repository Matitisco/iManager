# Almacenamiento duplicado — #483, punto 5

## Resultado

El arreglo ya estaba en `origin/main` al comenzar esta verificación (`f490f62`): PR [#492](https://github.com/Matitisco/iManager/pull/492), merge `b3344208d9eb463eec8721f504795a165c3e6844`. No se reprodujo el duplicado con ese código. Esta entrega refuerza la regresión y documenta evidencia local; no cambia comportamiento, CSS, backend ni schema.

## Causa raíz

`EquipmentForm` combina capacidades del catálogo, las cuatro opciones base e inventario. `Set` y `catalogChoices` comparaban textos exactos: `128GB`, `128 GB`, `128gb` y `128\u00a0GB` quedaban separados. Hay un solo campo JSX, compartido por alta y edición. La diferencia reportada entre los modales no corresponde a dos implementaciones distintas.

El arreglo existente aplica `uniqueCapacityChoices` después de combinar las fuentes. Ignora espacios y mayúsculas de la unidad GB/TB, mantiene orden y etiquetas del catálogo y conserva el valor histórico seleccionado al guardar una edición. No convierte TB a GB ni reescribe datos guardados.

## Regresión agregada

Cuatro escenarios de componente/integración con `CatalogProvider` y `DeskOverlays`: `128 GB`, `128gb`, espacio no separable y `1 tb`. El catálogo llega después de abrir la edición, incluye equivalentes duplicados y usa IDs de filas distintos de sus valores. Se verifica una única opción por capacidad, una única selección, persistencia del texto histórico y deselección con persistencia vacía.

Las cuatro pruebas fallaron al sustituir temporalmente la deduplicación por la devolución de las opciones sin procesar. El archivo de producción se restauró exactamente y las cuatro pasaron. La sustitución y los logs de fallo son evidencia local, no parte del cambio.

## Entorno y evidencia

App de este worktree: API `3370`, web `4370`, PostgreSQL falso `127.0.0.1:5433/imanager_483a`. Login local `dueno@imanager.local`. Integraciones en una DB independiente: `imanager_483a_tests`. Sin acceso a servicios de producción ni migraciones destructivas.

Capturas y scripts en `/workspace/qa-483/almacenamiento/`. Chrome `/usr/bin/google-chrome`, `--no-sandbox`; escritorio 1440×900 @1x y móvil 390×844 @2x.

| Archivo (cada uno con sufijos `1440` y `390`) | Evidencia |
| --- | --- |
| `main-registrar-*.png` | Estado inicial de main, sin duplicados |
| `antes-reconstruido-registrar-*.png` | Comportamiento anterior reconstruido temporalmente: nueve opciones, cuatro duplicados |
| `despues-registrar-*.png` | Cinco opciones distintas después de restaurar el arreglo |
| `despues-registrar-seleccionado-*.png` | Alta con 128GB seleccionado |
| `despues-editar-historico-*.png` | Edición con 128 GB histórico representado por una sola opción seleccionada |

`capturar.mjs` y `flujo-critico.mjs` están en la misma carpeta. El flujo crítico crea un equipo y edita otro histórico en cada viewport, confirma respuestas HTTP exitosas y el payload `capacity: '128 GB'` al editar, sin errores de página. También comprueba encabezado/pie dentro del viewport, ausencia de overflow horizontal y scroll interno. PNG finales revisados visualmente. Todos los datos de esas capturas son falsos.

Se mantienen los componentes reales `Sheet`, `Field`, `Segs` y `Actions`, con `.sheet-frame`, `.sheet-scroll` y `.sheet-foot`; no se agregan estilos ni textos de UI.

## Límites

El bug original está resuelto por #492. No hay un cambio funcional adicional justificado para este punto. No se modifican los demás puntos de #483. El verificador externo de clases señala `.hist-screen` ausente en main (el historial móvil fue cambiado por #528); no pertenece al selector de capacidades y esta entrega no cambia esa clase.

La primera pasada amplia detectó un timeout de arranque de un worker Vitest de frontend (`csv.test.ts`) y otro de integración (`optional-imei.integration.test.ts`); ambos archivos pasaron al reintentarlos. La prueba ajena `repair-history.integration.test.ts` fallaba con la zona horaria inicial de la DB local (Argentina) y pasó al fijar únicamente `imanager_483a_tests` en UTC, como CI. Estos ajustes no cambiaron archivos del producto ni la DB de la app.

## Verificación automatizada

- TypeScript/lint: `npm run lint` y `npm --prefix backend run lint`, aprobados.
- Frontend completo: 218 archivos / 1.927 pruebas cubiertos. En la primera pasada, 217 archivos / 1.925 pruebas pasaron; el único archivo sin ejecutar por timeout de worker (`csv.test.ts`, 2 pruebas) pasó al repetirlo. La repetición amplia también registró un timeout ajeno en `DashboardScreen.test.tsx`; sus 38 pruebas pasaron al repetir ese archivo (6,36 s).
- Backend unitario completo: 84 archivos / 606 pruebas aprobadas.
- Backend integración completo: 46 archivos / 412 pruebas cubiertos con DB local dedicada. Tras alinear la zona horaria, la pasada amplia dejó un deadlock ajeno en el `TRUNCATE` de `resetDatabase` al preparar `supplier-patterns.integration.test.ts`. Sus 8 pruebas pasaron al repetir solo ese archivo; las 7 de `repair-history`/`optional-imei` también pasaron. No se cambió código para ocultar fallos.
- Flujo crítico local de alta y edición: aprobado en ambos tamaños con Chrome y API/DB reales locales.
- `git diff --check`: aprobado. Sin build local.

Los logs completos y los reintentos permanecen junto a las capturas. Los incidentes de las suites amplias se informan explícitamente; la cobertura enumerada no implica que esas primeras ejecuciones hayan terminado con código cero.
