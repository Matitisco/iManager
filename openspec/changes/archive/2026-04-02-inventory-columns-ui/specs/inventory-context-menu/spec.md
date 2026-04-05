## ADDED Requirements

### Requirement: Menú contextual en filas con click derecho
La tabla de inventario SHALL mostrar un menú contextual al hacer click derecho sobre cualquier fila, con acciones relevantes al item y a la selección actual.

#### Scenario: Click derecho en fila sin selección
- **WHEN** el usuario hace click derecho en una fila sin selección masiva activa
- **THEN** aparece un menú con acciones individuales: Editar, Eliminar, Mover a categoría

#### Scenario: Click derecho con selección masiva
- **WHEN** el usuario hace click derecho en una fila mientras hay N filas seleccionadas
- **THEN** el menú muestra tanto las acciones individuales como las acciones bulk sobre los N items

#### Scenario: Cierre del menú
- **WHEN** el usuario hace click fuera del menú contextual
- **THEN** el menú se cierra sin ejecutar ninguna acción

### Requirement: Escape deselecciona todos los rows
El sistema SHALL limpiar la selección masiva al presionar la tecla Escape.

#### Scenario: Escape con selección activa
- **WHEN** hay filas seleccionadas y el usuario presiona Escape
- **THEN** todos los checkboxes se desmarcan y la barra de bulk actions desaparece
