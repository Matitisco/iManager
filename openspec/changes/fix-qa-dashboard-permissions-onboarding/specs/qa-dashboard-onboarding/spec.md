## ADDED Requirements

### Requirement: Onboarding tras perder la última membresía
El onboarding MUST permitir crear una tienda propia a una cuenta sin membresías activas, conservando la membresía eliminada como historial sin devolver acceso a ella.

#### Scenario: Empleado eliminado crea su tienda
- **WHEN** el dueño eliminó la única membresía del empleado y éste completa onboarding
- **THEN** obtiene una tienda nueva con rol OWNER y sigue sin acceso a la anterior.

### Requirement: Reporte coherente con configuración monetaria
El dashboard MUST consultar un reporte nuevo cuando cambia la moneda o configuración de cotización del local y MUST impedir que una respuesta de la configuración anterior lo reemplace.

#### Scenario: Cambio de moneda o cotización
- **WHEN** cambia la configuración monetaria mientras el dashboard está montado o antes de volver desde Configuración
- **THEN** los KPIs usan un nuevo reporte y no un snapshot calculado con la configuración anterior.

### Requirement: Navegación según permisos sin restringir costos de STAFF
Los KPIs financieros MUST conservar el acceso de lectura de #691 y MUST ofrecer navegación a Reportes sólo cuando esa sección está autorizada.

#### Scenario: Empleado sin Reportes
- **WHEN** STAFF tiene Dashboard pero no Reportes
- **THEN** ve ventas y margen sin un botón que lo lleve a una pantalla de acceso denegado.

### Requirement: Equipo configurado con acceso vigente
Primeros pasos MUST considerar Equipo listo sólo si hay miembros activos adicionales o una invitación pendiente vigente.

#### Scenario: Única invitación cancelada o vencida
- **WHEN** sólo queda el dueño y la invitación ya no permite incorporarse
- **THEN** el paso Equipo permanece pendiente.
