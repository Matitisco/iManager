## ADDED Requirements

### Requirement: Invitaciones respetan permisos vigentes
El backend SHALL impedir que MANAGER obtenga enlaces de roles que no puede invitar. Una reincorporación SHALL usar los permisos de la invitación vigente.

#### Scenario: Listado por MANAGER
- **WHEN** MANAGER lista las invitaciones pendientes
- **THEN** recibe únicamente invitaciones STAFF

#### Scenario: Reincorporación sin acceso sensible
- **WHEN** un exmiembro con acceso sensible anterior acepta una nueva invitación sin ese permiso
- **THEN** su membresía usa el valor predeterminado del nuevo rol, sin heredar el permiso anterior
