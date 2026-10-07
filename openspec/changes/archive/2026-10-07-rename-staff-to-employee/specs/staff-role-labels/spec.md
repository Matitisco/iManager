## ADDED Requirements

### Requirement: Nombre visible del rol STAFF

La interfaz MUST mostrar Empleado como nombre del rol STAFF en todas sus referencias visibles y Empleados cuando corresponda el plural.

#### Scenario: Invitar a un empleado
- **WHEN** el usuario selecciona STAFF al generar una invitación
- **THEN** el selector, la ayuda y la confirmación muestran Empleado
- **AND** el valor enviado a la API sigue siendo STAFF

#### Scenario: Consultar el rol de un miembro
- **WHEN** se muestra el rol STAFF en equipo, perfil, navegación, invitaciones, login, onboarding o selector de tienda
- **THEN** el nombre visible es Empleado

#### Scenario: Conservar los permisos del rol
- **WHEN** un miembro tiene el rol STAFF
- **THEN** sus permisos y datos persistidos se mantienen sin cambios
