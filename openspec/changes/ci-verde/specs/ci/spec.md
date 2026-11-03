## ADDED Requirements

### Requirement: Regresiones compatibles con los contratos vigentes
La CI completa SHALL ejecutar E2E, PWA y backend conservando los resguardos de seguridad y la cobertura de persistencia.

#### Scenario: Ejecución completa de la rama
- **WHEN** se despacha ci.yml sobre la rama de la corrección
- **THEN** todos los jobs obligatorios y el agregador test finalizan correctamente sin omisiones nuevas silenciosas.
