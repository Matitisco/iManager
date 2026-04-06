## ADDED Requirements

### Requirement: Botón de exportación en toolbar
El sistema SHALL mostrar un botón "Exportar" en el toolbar del módulo Inventory. El botón SHALL estar disponible en todo momento (no requiere selección de ítems).

#### Scenario: Botón visible en toolbar
- **WHEN** el usuario abre el módulo Inventory
- **THEN** el toolbar muestra un botón "Exportar" junto a los controles existentes

#### Scenario: Feedback durante generación
- **WHEN** el usuario hace click en "Exportar"
- **THEN** el botón muestra un estado de carga ("Exportando...") mientras se genera el archivo

### Requirement: Exportación respeta columnas visibles
El sistema SHALL exportar únicamente las columnas actualmente visibles, en el orden en que aparecen en la tabla. Columnas ocultas mediante el toggle de visibilidad SHALL ser excluidas del archivo exportado.

#### Scenario: Columnas ocultas excluidas
- **WHEN** el usuario tiene columnas ocultas y hace click en "Exportar"
- **THEN** el archivo descargado no contiene las columnas ocultas

#### Scenario: Orden de columnas respetado
- **WHEN** el usuario ha reordenado columnas y hace click en "Exportar"
- **THEN** el archivo descargado presenta las columnas en el mismo orden que la tabla

#### Scenario: Headers con nombres renombrados
- **WHEN** el usuario ha renombrado una columna (ej. "Modelo" → "Marca") y exporta
- **THEN** el header de esa columna en el XLSX muestra el nombre renombrado ("Marca")

### Requirement: Exportación respeta filtros y orden activos
El sistema SHALL exportar todos los ítems actualmente filtrados y ordenados, sin limitarse a la página visible. Ítems excluidos por el filtro activo SHALL ser omitidos del archivo.

#### Scenario: Solo ítems filtrados en el export
- **WHEN** hay un filtro de búsqueda activo y el usuario exporta
- **THEN** el archivo contiene únicamente los ítems que pasan el filtro activo, no el inventario completo

#### Scenario: Orden del export coincide con tabla
- **WHEN** el usuario ha aplicado un orden (ej. por Precio descendente) y exporta
- **THEN** el archivo presenta los ítems en ese mismo orden

#### Scenario: Export incluye todos los filtrados, no solo la página actual
- **WHEN** hay más ítems filtrados que los que caben en la página visible y el usuario exporta
- **THEN** el archivo contiene todos los ítems filtrados, no solo los de la página actual

### Requirement: Formato y nombre de archivo
El sistema SHALL descargar el archivo en formato `.xlsx` con el nombre `inventory_YYYY-MM-DD.xlsx` donde la fecha corresponde al día de la exportación. Celdas sin valor SHALL exportarse como vacías (no como el placeholder "---").

#### Scenario: Nombre de archivo con fecha
- **WHEN** el usuario exporta el inventario el día 2026-04-06
- **THEN** el archivo descargado se llama `inventory_2026-04-06.xlsx`

#### Scenario: Celdas vacías como vacías
- **WHEN** un ítem tiene campos sin valor (que muestran "---" en la tabla)
- **THEN** esas celdas aparecen vacías en el XLSX, no con el texto "---"
