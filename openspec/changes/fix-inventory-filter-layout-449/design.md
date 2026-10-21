## Layout

El problema se reproduce en `origin/main` 9b30ecf: `.chk` impone width/height 18 px al label. Sobrescribir dimensiones solo en `.inv-filter-sheet .inv-checks .chk`, dejar el input fijo y envolver el texto en un span flexible. Las opciones usan todo el ancho, altura automática y mínimo 44 px; no cambiar `.chk` global ni otros formularios. Reutilizar Sheet/Actions existentes.

## Recorrido

Mantener Para completar, Estado, Condición y Calidad; luego Batería y Precio. Color al final en details: abierto con hasta seis opciones, plegado para listas mayores. Búsqueda local sin distinción de mayúsculas/acentos, exclusivamente para encontrar opciones; los IDs y valores enviados al filtro siguen exactos. Resumen muestra cantidad seleccionada, incluso con búsqueda sin coincidencias. Ninguna opción histórica se elimina ni agrupa.

## Estado

Abrir copia los filtros vigentes y reinicia la búsqueda. Cambiar checkboxes, batería, precios y Limpiar modifica únicamente el borrador. Cerrar por botón, Escape o fondo lo descarta; Aplicar confirma. Mostrar cantidad de grupos del borrador y aclarar que Limpiar requiere Aplicar. Conservar badge/cantidad vigentes fuera del panel y reset de paginación.

## Validación

Tests de interacción con etiquetas completas, búsqueda, colores históricos/compuestos, ausencia de coincidencias, cierre/restauración, limpiar/aplicar y resultados. Fixture del componente real con datos sintéticos y capturas antes/después en 320×844, 390×844, 1440×900 y 1536×640, sin despliegue completo ni backend. Suites frontend, backend unitario/integración local y lint en ambos paquetes. Registrar versión servida por HTTP sin PWA; no se dispone de sesión productiva.
