## ADDED Requirements

### Requirement: Avisos accesibles sin bloquear acciones
El shell SHALL mostrar avisos sin superponer controles de las pantallas.

#### Scenario: Aviso de cotización o plan vencido
- **WHEN** se muestra un aviso persistente en escritorio o teléfono
- **THEN** el usuario puede operar los controles permitidos y acceder a facturación con clics normales

### Requirement: Regresiones de presentación vigentes
La CI SHALL validar los comportamientos actuales de recuperación, navegación y persistencia sin depender de animaciones retiradas.

#### Scenario: Actualización con datos previos
- **WHEN** falla una recarga del catálogo por falta de red
- **THEN** conserva los datos anteriores y se actualiza al recuperar la conexión sin banner offline
