## MODIFIED Requirements

### Requirement: Menú contextual en filas con click derecho
La tabla de inventario SHALL mostrar un menú contextual al hacer click derecho sobre cualquier fila, con acciones relevantes al item y a la selección actual.

#### Scenario: Click derecho en fila sin selección
- **WHEN** el usuario hace click derecho en una fila sin selección masiva activa
- **THEN** aparece un menú con acciones individuales: Agregar ítem, Editar, Eliminar, Mover a categoría

#### Scenario: Click derecho con selección masiva
- **WHEN** el usuario hace click derecho en una fila mientras hay N filas seleccionadas
- **THEN** el menú muestra tanto las acciones individuales (Agregar ítem, Editar, Eliminar, Mover a categoría) como las acciones bulk sobre los N items

#### Scenario: Cierre del menú
- **WHEN** el usuario hace click fuera del menú contextual
- **THEN** el menú se cierra sin ejecutar ninguna acción
