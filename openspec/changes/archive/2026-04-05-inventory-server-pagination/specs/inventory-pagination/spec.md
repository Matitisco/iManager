## MODIFIED Requirements

### Requirement: Tabla paginada con 20 items por página
La tabla de inventario SHALL cargar ítems desde el servidor en batches de 30 usando scroll infinito. No hay botones de paginación. El usuario scrollea hacia abajo para cargar más ítems. La paginación anterior basada en `array.slice()` local es reemplazada por fetches reales al servidor con `LIMIT 30 OFFSET skip`.

#### Scenario: Carga inicial
- **WHEN** el usuario abre la página de Inventory
- **THEN** se muestran los primeros 30 ítems cargados desde el servidor y se muestra el total (ej. "162 equipos")

#### Scenario: Scroll infinito carga más ítems
- **WHEN** el usuario scrollea hasta el final de la tabla y hay más ítems por cargar
- **THEN** se muestra una animación de carga (spinner) y se agregan los siguientes 30 ítems al final de la lista

#### Scenario: Fin de lista
- **WHEN** el usuario scrollea hasta el final y ya se cargaron todos los ítems (`items.length >= total`)
- **THEN** no se dispara ningún fetch adicional

#### Scenario: Reset al cambiar filtros
- **WHEN** el usuario cambia cualquier filtro (categoría, condición, estado, capacidad, modelo, grado, batería) u orden
- **THEN** la lista se resetea a vacío, se realiza un nuevo fetch desde `skip=0` con los nuevos parámetros y se muestran los primeros 30 ítems

## REMOVED Requirements

### Requirement: Botones con elipsis
**Reason**: El scroll infinito reemplaza completamente la navegación por botones numerados y elipsis.
**Migration**: No hay migración necesaria — el usuario ahora scrollea para cargar más contenido.
