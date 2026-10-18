## ADDED Requirements

### Requirement: Acceso por sección y gestión de equipo
El sistema SHALL aplicar los roles y secciones aprobados en issue #71 tanto en API como en UI.

#### Scenario: Socio gestiona un Empleado
- **WHEN** un Socio invita o edita un Empleado ajeno
- **THEN** puede gestionar sus secciones, sin promoverlo a Socio ni editar otros Socios, Propietarios o a sí mismo

### Requirement: Invitaciones por enlace
El sistema SHALL aceptar un enlace válido una sola vez sin exigir coincidencia de email, y distinguir invitaciones vencidas, usadas, revocadas e inexistentes.

#### Scenario: Aceptación concurrente
- **WHEN** dos cuentas aceptan el mismo enlace
- **THEN** sólo una se incorpora y la invitación queda ACCEPTED dentro de la transacción
