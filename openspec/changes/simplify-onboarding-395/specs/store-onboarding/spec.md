## MODIFIED Requirements

### Requirement: Recorrido inicial
El sistema SHALL ofrecer dos pasos: Nombre y Stock, con Excel como opción principal y la invitación solo en Primeros pasos.

#### Scenario: Cuenta nueva
- **WHEN** se guarda un nombre válido
- **THEN** aparece Paso 2 de 2 con Subir Excel primero, Pegar lista, A mano, muestras y Saltar por ahora.

#### Scenario: Reanudación
- **WHEN** recarga una tienda con onboarding incompleto, incluso en invite/video
- **THEN** retoma Stock; una tienda con onboarding completado no vuelve al recorrido.

## ADDED Requirements

### Requirement: Progreso con stock real
Primeros pasos MUST contar el nombre guardado como completo y excluir equipos de ejemplo del paso stock.

#### Scenario: Omisión o muestras
- **WHEN** una tienda nueva omite stock o carga muestras
- **THEN** Primeros pasos indica 1 de 5 con Datos de tu tienda completo y stock pendiente.

#### Scenario: Stock real
- **WHEN** guarda equipos por Excel, pegado o carga manual
- **THEN** Primeros pasos indica 2 de 5 con nombre y stock completos.
