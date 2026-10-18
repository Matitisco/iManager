# Diseño

Extender `usePagedRows` y `TablePager` con `pageSize` opcional, manteniendo el default de 8 para Inventario, Ventas, Canjes y Clientes. Catálogo usa 16 y aplica la búsqueda antes de paginar. La clave de reinicio incluye búsqueda y reglas guardadas, nunca la visibilidad individual ni la identidad de las filas.

El paginador queda al pie de la card, con estilos limitados a Catálogo: rango a la izquierda en desktop y centrado sobre los botones en móvil. Conservar el algoritmo existente de botones y elipsis. Al cambiar de página, medir el inicio de la card contra el área visible de `.stage` y desplazar suavemente sólo si quedó fuera de vista.

La selección usa IDs de todo el catálogo, independientemente de la página. Seleccionar/deseleccionar todos opera sobre todos los resultados filtrados; el contador informa cuántos seleccionados están fuera de la página actual. Las acciones masivas esperan la persistencia y conservan la selección ante errores.
