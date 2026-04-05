## MODIFIED Requirements

### Requirement: Mover productos entre categorías
El sistema SHALL permitir mover un producto individual o una selección masiva a otra categoría. Al ejecutar el move, las filas afectadas SHALL animar su salida de la vista actual antes de ser removidas del DOM. Al navegar a la categoría destino, las filas SHALL animar su entrada con un stagger corto. Las animaciones SHALL completarse en ≤ 150 ms para no introducir latencia perceptible.

#### Scenario: Mover item individual — exit animation
- **WHEN** el usuario selecciona "Mover a [Categoría]" en el menú contextual de un ítem, estando en una categoría filtrada (no "Todos")
- **THEN** la fila anima su salida (fade + slide horizontal) antes de desaparecer; la operación PATCH al backend se dispara inmediatamente sin esperar la animación

#### Scenario: Mover bulk — exit animation
- **WHEN** hay N items seleccionados y el usuario elige "Mover a categoría" en la barra de bulk actions o menú contextual, estando en una categoría filtrada
- **THEN** todas las N filas animan su salida simultáneamente (sin stagger); la duración total es ≤ 150 ms

#### Scenario: Navegar a categoría destino — enter animation
- **WHEN** el usuario hace click en un tab de categoría (incluyendo el destino de un move reciente)
- **THEN** las filas de esa categoría animan su entrada con un stagger de ≤ 15 ms por fila y duración de 100 ms por fila

#### Scenario: Tab "Todos" — sin exit animation
- **WHEN** el usuario mueve un ítem estando en el tab "Todos"
- **THEN** el ítem NO anima salida (permanece visible porque "Todos" muestra todo); la fila actualiza su categoryId de forma optimista
