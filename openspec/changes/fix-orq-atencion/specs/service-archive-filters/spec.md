## ADDED Requirements

### Requirement: Archived repairs respect the selected status
Servicio técnico SHALL aplicar los filtros de estado y búsqueda a las órdenes archivadas tanto en tablero y lista como en móvil.

#### Scenario: Specific status in archived mode
- **WHEN** se activa Archivados y se selecciona Recibido
- **THEN** sólo se muestran órdenes archivadas cuyo estado normalizado sea Recibido
- **AND** no se muestran órdenes En reparación aunque existan en el archivo

#### Scenario: Open archived orders
- **WHEN** se selecciona Abiertas en Archivados
- **THEN** no se muestran órdenes Entregado

#### Scenario: Search composes with status
- **WHEN** se busca un equipo en Archivados con un estado específico seleccionado
- **THEN** los resultados deben satisfacer ambos filtros

#### Scenario: Phone grouping
- **WHEN** se selecciona un estado específico en Archivados desde móvil
- **THEN** sólo se presenta el grupo de ese estado

#### Scenario: Active records keep their archive rules
- **WHEN** Archivados está desactivado y se selecciona un estado activo
- **THEN** las órdenes archivadas permanecen excluidas
