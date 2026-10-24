## ADDED Requirements

### Requirement: Reclamos de Fallas sin tercera capa
El sistema SHALL suspender la hoja de grupo o lista completa mientras el detalle de un reclamo está abierto, permitiendo abrir su historial con un máximo de dos diálogos montados.

#### Scenario: Historial desde la vista previa
- **WHEN** el usuario abre un reclamo desde las tres filas del grupo y abre su historial
- **THEN** solo el reclamo y su historial están montados como diálogos

#### Scenario: Historial desde todos los reclamos
- **WHEN** el usuario abre Todos los reclamos, selecciona uno y abre su historial
- **THEN** solo el reclamo y su historial están montados como diálogos

### Requirement: Retorno al origen del reclamo
El sistema SHALL conservar el grupo y la selección de lista completa, y restaurar el foco al reclamo al cerrar el detalle.

#### Scenario: Volver a la lista completa
- **WHEN** el usuario cierra el reclamo abierto desde Todos los reclamos
- **THEN** reaparece la lista completa con foco en la fila elegida

#### Scenario: Volver al grupo
- **WHEN** el usuario cierra el reclamo abierto desde el grupo
- **THEN** reaparece el mismo grupo con foco en la fila elegida
