## ADDED Requirements

### Requirement: Respuesta del control de canje
El formulario SHALL responder una vez por click o tap y conservar la selección al editar otros campos. Abrir o cerrar el panel SHALL conservar el estado del canje.

#### Scenario: Toques repetidos
- **WHEN** se acciona el control cinco veces en aproximadamente dos segundos
- **THEN** cada interacción cambia el estado correspondiente una vez, sin duplicación ni reversión involuntaria

#### Scenario: Feedback visual
- **WHEN** se presenta el panel móvil de canje
- **THEN** el usuario puede distinguir si el canje está incluido, incluso con el panel cerrado
