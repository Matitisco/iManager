## ADDED Requirements

### Requirement: Límites temporales independientes de la zona de PostgreSQL
El historial de reparaciones SHALL comparar límites y cursores en UTC.

#### Scenario: Eventos empatados y conexión en Buenos Aires
- **WHEN** se pagina o filtra un historial con una conexión PostgreSQL en una zona distinta de UTC
- **THEN** devuelve los mismos eventos y límites inclusivos que una conexión UTC sin omitir ni duplicar eventos
