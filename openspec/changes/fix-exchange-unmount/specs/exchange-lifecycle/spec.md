## ADDED Requirements

### Requirement: Cancelación de cotizaciones obsoletas
El proveedor de cotización MUST cancelar la consulta activa, invalidar sus respuestas y limpiar su intervalo al desmontarse o cambiar de configuración.

#### Scenario: Desmontaje con consulta pendiente
- **WHEN** se desmonta el proveedor mientras espera cualquiera de las fuentes de cotización
- **THEN** la consulta se cancela y ninguna respuesta posterior actualiza el estado ni guarda caché

#### Scenario: Cambio de configuración con consulta pendiente
- **WHEN** cambia la fuente o se selecciona una cotización manual mientras hay una consulta pendiente
- **THEN** el resultado o error anterior no sobrescribe la configuración vigente
