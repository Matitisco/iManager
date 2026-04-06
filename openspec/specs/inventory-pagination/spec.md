### Requirement: Scroll infinito con fetch server-side de 30 items
La tabla de inventario SHALL cargar ítems desde el servidor en batches de 30 usando scroll infinito. El usuario scrollea hacia abajo para cargar más ítems. La carga es real (fetch PostgreSQL con `LIMIT 30 OFFSET skip`) — no un slice de un array local.

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
- **THEN** la lista se resetea a vacío y se realiza un nuevo fetch desde `skip=0` con los nuevos parámetros
