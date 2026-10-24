## ADDED Requirements

### Requirement: Vista previa del catálogo sincronizada
El sistema SHALL actualizar la vista previa pública cuando cambie el catálogo administrado después de una operación guardada.

#### Scenario: Cambiar visibilidad
- **WHEN** el usuario publica u oculta un equipo y la operación devuelve el catálogo actualizado
- **THEN** la vista previa refleja la misma visibilidad sin recargar la página.

#### Scenario: Cambiar reglas o precio
- **WHEN** el usuario guarda reglas o configuración de precio
- **THEN** la vista previa vuelve a consultar los datos públicos y muestra la configuración persistida.

#### Scenario: Revalidación sin parpadeo ni resultados obsoletos
- **WHEN** comienza una consulta nueva y existe una vista previa resuelta
- **THEN** se conserva hasta resolver la nueva consulta y una respuesta anterior cancelada no reemplaza el resultado actual.
