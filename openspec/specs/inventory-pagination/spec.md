### Requirement: Tabla paginada con 20 items por página
La tabla de inventario SHALL mostrar como máximo 20 productos por página. El usuario puede navegar entre páginas mediante botones numerados.

#### Scenario: Inventario con más de 20 items
- **WHEN** el store tiene 45 productos y el usuario abre Inventory
- **THEN** se muestran los primeros 20; los botones de paginación muestran páginas 1, 2, 3

#### Scenario: Botones con elipsis
- **WHEN** hay más de 5 páginas
- **THEN** los botones muestran primera, última y páginas cercanas a la actual; las intermedias se reemplazan con "..."

#### Scenario: Reset de página al filtrar
- **WHEN** el usuario cambia el filtro de categoría o escribe en el buscador
- **THEN** la paginación vuelve a la página 1
