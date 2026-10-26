## ADDED Requirements
### Requirement: Recepción posterior al rechazo de RMA
El sistema SHALL permitir recibir físicamente un equipo con RMA rechazado conservando su resolución económica y su historial.
#### Scenario: Proveedor devuelve un equipo rechazado
- **WHEN** se registra RECIBIDO para un reclamo RESUELTO con destino PROVEEDOR y RMA RECHAZADO
- **THEN** se registra la recepción y el stock correspondiente sin cambiar la fecha de resolución ni emitir otra compensación
#### Scenario: RMA rechazado no admite reabrir cobertura
- **WHEN** se intenta aprobar un RMA rechazado o recibir dos veces el equipo
- **THEN** se rechaza la transición sin duplicar eventos
