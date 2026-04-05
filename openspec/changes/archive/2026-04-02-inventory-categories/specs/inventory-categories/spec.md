## ADDED Requirements

### Requirement: Categorías organizan el inventario por tabs
El sistema SHALL permitir al usuario crear categorías como tabs sobre la tabla de inventario. Hacer click en un tab filtra la tabla a los productos de esa categoría. El tab "Todos" muestra todos los productos.

#### Scenario: Filtrar por categoría
- **WHEN** el usuario hace click en el tab "iPhone"
- **THEN** la tabla muestra solo los productos con categoryId = "iPhone"; la paginación se resetea

#### Scenario: Tab "Todos" siempre presente
- **WHEN** el usuario abre Inventory
- **THEN** el tab "Todos" está siempre visible como primera opción; no puede eliminarse

### Requirement: CRUD de categorías
El sistema SHALL permitir crear, renombrar y eliminar categorías. Al eliminar una categoría, los productos de esa categoría quedan sin categoría asignada (no se eliminan).

#### Scenario: Crear categoría
- **WHEN** el usuario hace click en "+" e ingresa un nombre
- **THEN** se crea la categoría en el backend y aparece un nuevo tab

#### Scenario: Eliminar categoría con confirmación
- **WHEN** el usuario elige eliminar un tab
- **THEN** aparece un modal de confirmación antes de proceder; al confirmar, los productos quedan sin categoría

#### Scenario: Rename inline
- **WHEN** el usuario hace doble click en un tab
- **THEN** el tab muestra un input inline; Enter o blur guarda; Escape cancela sin guardar

### Requirement: DnD para reordenar tabs
El sistema SHALL permitir reordenar los tabs de categoría arrastrándolos. Durante el drag, se muestra un bloque flotante y el cursor está oculto.

#### Scenario: Reordenar tabs
- **WHEN** el usuario arrastra un tab a otra posición
- **THEN** el nuevo orden se persiste en el backend; los tabs se renderizan en el nuevo orden

### Requirement: Mover productos entre categorías
El sistema SHALL permitir mover un producto individual o una selección masiva a otra categoría.

#### Scenario: Mover item individual
- **WHEN** el usuario selecciona "Mover a" en el menú de un producto y elige una categoría
- **THEN** el producto se actualiza con el nuevo categoryId

#### Scenario: Mover bulk
- **WHEN** hay N items seleccionados y el usuario elige "Mover a categoría" en la barra de bulk actions
- **THEN** todos los N items se actualizan con el nuevo categoryId
