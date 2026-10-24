# QA de importaciones — 23/10/2026

Prueba con Chromium real mediante Playwright, clics, selectores y carga de archivos desde la UI. Las comprobaciones de negocio de esta matriz no usan llamadas directas a la API ni respuestas de importación simuladas. Login local del dueño, API 3490/web 4490, base falsa `imanager_importqa`. Sin acceso a producción, lectura de secretos, cambios de Prisma ni archivos de Patrones/Fallas.

## Archivos y recorrido

La UI ofrece **equipos, clientes y ventas**. Para cada tipo se generaron un XLSX limpio de 50 filas, un CSV desordenado con 50 registros únicos, una repetición y una fila vacía/inválida, y un XLSX ajeno de cultivos. Ubicación: `/workspace/qa-import/archivos/`; generador reproducible: `/workspace/qa-import/generate.cjs`. Todos los datos de QA son ficticios.

Equipos/ventas incluyen iPhone 11–16 Pro, capacidades, colores, IMEIs de prueba con dígito verificador, ARS/USD, costos, proveedores y fechas dd/mm/aaaa donde corresponden. Clientes incluyen nombres con acentos, DNI, WhatsApp, correo e Instagram. El CSV cambia orden/nombres, conserva campos opcionales vacíos, importes con coma y comillas. También se subió `/workspace/imanager-local/Stock iPhone Mendoza.xlsx`.

Se verificaron preview, fila final de las listas virtualizadas, cambios reales de mapeo (quitar/restaurar columna), confirmación, repetición y conteos de las pantallas. Los tres tipos se recorrieron a 1440×900 y 390×844. Capturas finales desktop @1x y móvil @2x. Se recargó la app y se comprobaron los conteos persistidos.

## Resultados

| Tipo | Archivo limpio | Desordenado y repetición | Ajeno | Resultado |
|---|---|---|---|---|
| Equipos | 50 creados en la primera pasada; nuevas pasadas actualizan los mismos 50 | 50 creados + 1 actualizado; repetir: 0 creados + 51 actualizados | Aviso específico, sin confirmar | OK con IMEI; falla pendiente sin identificador |
| Clientes | 50 creados; repetir: 0 creados + 50 actualizados | 50 creados + 1 actualizado; repetir: 0 creados + 51 actualizados | Aviso específico, sin confirmar | OK |
| Ventas | 50 creadas; repetir después del fix: 0 creadas + 50 errores de repetición | 50 creadas; duplicado bloqueado. La fila con precio inválido ahora se conserva y muestra error; repetir: 0 creadas + 52 errores | Aviso específico, sin confirmar | OK para importaciones nuevas |

Conteos finales de UI tras recarga: **362 equipos**, **106 clientes**, **221 ventas con el filtro Mes**. Equipos: base 166 + 50 limpios + 50 desordenados + 48 Mendoza + 48 al repetir Mendoza. Clientes: base 6 + 50 limpios + 50 desordenados. Ventas pasó de 121 a 171 y 221 en las dos importaciones posteriores a la corrección; los reintentos mantienen 221. La reproducción anterior al fix ya había creado ventas duplicadas en esta base falsa; no se borraron ni se reescribieron.

Análisis local: **112–150 ms**. Confirmación de 50 filas: equipos **394–442 ms**, clientes **152–168 ms**, ventas nuevas **1,9 s**, rechazos repetidos **0,4 s**. Cero errores de página y cero textos visibles `Cargando…`, `[object Object]`, `undefined` o `NaN` en las corridas registradas. La captura por frames mantuvo el modal presente en 9/9 cuadros: antes se contraía de 436 a 302 px durante lectura; después conserva 436 px hasta la preview de 542 px. Sin desborde horizontal ni pie de modal fuera de pantalla. Encabezado y pie permanecen accesibles mientras el contenido scrollea.

## Correcciones

- CSV: deja de separar comas dentro de campos entre comillas; admite punto y coma/tabulación, BOM, comillas escapadas y saltos de línea internos. Comillas sin cerrar generan un error legible en la UI.
- Equipos: moneda disponible en el mapeo y conservada desde columna/celda/encabezado durante análisis, preview y persistencia. Ejemplo: `410 USD` deja de convertirse en `410 ARS` por omisión de la moneda.
- Ventas: huella normalizada por tienda y bloqueo transaccional impiden repetir una importación idéntica, incluso con solicitudes concurrentes, sin volver a afectar stock, clientes ni numeración.
- Una venta reconocible con precio inválido permanece visible para revisión y error por fila.
- Se reserva la altura del contenido durante el análisis para evitar el encogimiento transitorio del modal.
- Los resultados con filas rechazadas indican **Importación con errores**, sin presentar éxito total. Singular de «1 error» corregido.

Validación local: TypeScript frontend/backend; **38 pruebas frontend**, **146 unitarias backend relacionadas**, **1 integración de reintentos concurrentes** en la base falsa separada `imanager_importqa_test`. Sin build ni suite completa local.

## Pendientes y límites

- **Mendoza sin IMEI:** se reconocen 48 equipos de dos hojas, pero confirmar el mismo archivo otra vez crea otros 48 (314 → 362). Deducir identidad por modelo/precio borraría unidades legítimas iguales. Requiere definir identidad de lote/archivo para reintentos; no se impuso unicidad por descripción.
- La protección nueva de ventas cubre filas idénticas importadas con esta versión. Las anteriores no tienen huella. Una venta idéntica sin identificador externo en el mismo día se trata como repetida; cambios de importe/datos representan otra fila.
- Proveedor y fecha de ingreso no están disponibles como columnas del mapeo genérico de equipos; se conserva el flujo existente de importación desde proveedor. Agregar su vínculo desde la planilla queda fuera de esta corrección.
- Diseño reportado: modal desktop de **600 px**, frente a 540 px de la guía; listas con scroll de más de tres filas, frente al patrón «Ver todas». No se rediseñó. En móvil mide 390 px; mapeo alto máximo 776,5 px, con pie fijo dentro de 844 px.
- Los servicios externos permanecieron bloqueados desde el navegador y las claves locales vacías. El aviso de cotización ausente del fondo pertenece al entorno de prueba; la importación conserva importes y monedas sin inventar una cotización.

## Evidencia

- `/workspace/qa-import/01-equipos-1440.png`: 50 equipos, preview con ARS/USD.
- `/workspace/qa-import/02-clientes-mapeo-390.png`: mapeo móvil de aliases.
- `/workspace/qa-import/03-ventas-390.png`: repetidos rechazados y resultado explícito.
- `/workspace/qa-import/04-mendoza-1440.png`: 48 equipos, dos hojas.

Resultados detallados y tiempos en `before-results.json`, `after-results.json`, `final-validation.json` y `frames.json` dentro de `/workspace/qa-import/`. Scripts de navegador en esa misma carpeta; no contienen acceso a bases reales. Los logs `tests-*.log` y `lint-*.log` conservan la validación relacionada.
