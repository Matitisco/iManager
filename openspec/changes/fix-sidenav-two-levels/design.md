# Diseño

El registro de destinos incorpora patterns y su ruta analisis/patrones. El sidenav renderiza directamente los destinos de cada grupo. Se separa PatternsScreen de ReturnsScreen, manteniendo los filtros de agrupación en la pantalla y la caché por alcance. La canonicalización migra queries antiguas sin perder proveedor/agrupación ni crear pasos de historial. Resumen periódico conserva su ruta propia y se muestra como hermano. Catálogo móvil muestra sus secciones juntas. No se modifican API, Prisma ni permisos persistidos.
