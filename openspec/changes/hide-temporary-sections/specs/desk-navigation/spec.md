## ADDED Requirements

### Requirement: Visibilidad temporal centralizada
El sistema MUST ocultar las secciones configuradas sin eliminar su código.

#### Scenario: Acceso desde navegación
- **WHEN** se muestra la navegación en móvil o escritorio
- **THEN** no aparecen las secciones ocultas ni grupos vacíos

#### Scenario: Ruta oculta
- **WHEN** se abre una ruta oculta o un estado anterior de Clientes
- **THEN** se muestra Dashboard o la lista de Clientes según corresponda
