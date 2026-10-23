# Diseño

PatternsScreen monta ReturnsPatterns una vez por agrupación, con encabezados pequeños dch y layout dgrid. Solo la agrupación indicada por un enlace recibe requestedGroup. Cada instancia mantiene su caché y selección; el scope de sesión sigue invalidándolas al cambiar de tienda o permisos. Se retira el CSS del selector.

Sin cambios de backend, schema, navegación global ni filtros de estado. Verificación con TypeScript, pruebas del módulo y navegador local a 1440/390 sobre PostgreSQL falso imanager_patrones.
