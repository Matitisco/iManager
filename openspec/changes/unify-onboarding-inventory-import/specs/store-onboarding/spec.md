## ADDED Requirements

### Requirement: Importación de stock compartida con Inventario
El paso de stock del onboarding SHALL usar el mismo flujo, componentes, catálogo de campos y endpoints de análisis, reaplicación y confirmación que Inventario.

#### Scenario: Subir Excel desde onboarding
- **WHEN** el usuario elige Subir Excel en el segundo paso
- **THEN** se abre el importador compartido con análisis automático, selector de campos en encabezados y vista previa
- **AND** cada fila con datos conserva un equipo y los IMEI duplicados quedan marcados sin descartar filas

#### Scenario: Cancelación y error
- **WHEN** el usuario cancela o falla la persistencia
- **THEN** no se completa el onboarding y puede volver a intentar

#### Scenario: Confirmación exitosa
- **WHEN** la confirmación guarda equipos sin errores
- **THEN** se completa el paso de stock y se navega al inventario aunque falle una recarga posterior
