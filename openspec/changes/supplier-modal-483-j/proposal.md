# Proveedor: ficha, alta y edición (#483, punto 13)

Reorganizar los modales de Proveedores para separar contacto, notas, compras y acciones. Corregir el contenido pegado a los bordes y garantizar legibilidad en 1440 y 390 px con DM Sans y el diseño actual.

Corrección #308: reemplazar temporalmente la ficha de proveedor y el formulario de gasto por su confirmación de archivado, evitando dos diálogos encimados. Cancelar conserva los datos cargados y las ediciones; un fallo mantiene la confirmación y su error.

## Non-goals

Sin cambios de backend, AppContext, Prisma, importación, producción ni puntos 6, 8 o 14. Conservar los puntos previos de feat/483-medios y actualizar únicamente el PR #495, sin merge.
