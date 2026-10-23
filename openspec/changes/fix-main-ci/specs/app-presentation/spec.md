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


### Requirement: Una toma de control tardía no anuncia la versión ya cargada
La PWA SHALL comprobar la versión del servidor cuando cambia el controlador del worker y SHALL omitir el aviso si coincide con el bundle actual.

#### Scenario: El worker reclama después de una actualización explícita
- **WHEN** la página ya cargó el bundle actual y el nuevo worker la controla después
- **THEN** no reaparece el aviso de actualización ni se provoca otra recarga

#### Scenario: La versión es nueva o no se puede consultar
- **WHEN** el controlador cambia y la versión difiere o no está disponible
- **THEN** se conservan la confirmación, protección de borradores y actualización segura existentes
