## ADDED Requirements

### Requirement: Apertura de permisos con miembros disponibles
El frontend MUST reutilizar los miembros disponibles durante la navegación interna de Configuración, manteniendo el aislamiento por usuario, tienda y permisos.

#### Scenario: Abrir y volver a un miembro
- **WHEN** se abre un miembro desde Equipo y se vuelve a la lista
- **THEN** los datos se muestran sin repetir las consultas de miembros e invitaciones

#### Scenario: Invitaciones demoradas
- **WHEN** los miembros llegan antes que las invitaciones al abrir un enlace directo
- **THEN** el editor muestra los permisos sin esperar las invitaciones

#### Scenario: Cambio de miembro
- **WHEN** se navega entre miembros
- **THEN** el editor inicia con los permisos del miembro seleccionado sin conservar el borrador anterior
