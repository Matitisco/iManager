## ADDED Requirements

### Requirement: Detalle batería visible en el listado
Inventory SHALL mostrar `item.batteryNote` en una columna «Detalle batería» inmediatamente después de Batería en desktop y después de la información de batería en las tarjetas mobile. El contenido MUST truncarse con elipsis sin alterar los anchos existentes y conservar el texto completo en `title`.

#### Scenario: Nota larga
- **WHEN** el equipo tiene una nota de batería mayor al espacio disponible
- **THEN** la nota se muestra con elipsis y su texto completo está disponible en `title`

#### Scenario: Nota vacía
- **WHEN** `batteryNote` es null, undefined, vacío o solo espacios
- **THEN** se muestra «—»
