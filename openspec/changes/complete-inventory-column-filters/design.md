# Design

Extender InventoryColumnFilters y su predicado, clave de paginación y detección de actividad. Reutilizar ColumnFilter, DateRange, MoneyRange, Sheet, Field y las clases existentes. Los filtros de columna se aplican inmediatamente; la hoja móvil conserva borrador y confirma con Aplicar filtros. Rangos inclusivos y abiertos; fechas sin ingreso no coinciden con un rango. Texto combina búsqueda y presencia. Cantidad histórica por defecto 1; costo ausente no equivale a cero. Catálogo admite ambos valores. Mantener presets de batería y añadir máximo/mínimo.

Validar predicados y componentes, permisos, limpieza y composición con búsqueda. E2E y capturas 1440×900 y 390×844 con datos sintéticos. Sin build ni watchers.
