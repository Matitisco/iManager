## ADDED Requirements

### Requirement: Validación visible
El onboarding SHALL enfocar y hacer visible el mensaje de error al rechazar el envío.

#### Scenario: Cotización manual inválida en móvil
- **WHEN** se pulsa Seguir con compra mayor que venta
- **THEN** se muestra y enfoca el error sin enviar la creación de tienda

#### Scenario: Intento repetido
- **WHEN** se vuelve a enviar sin corregir el error
- **THEN** el foco vuelve al mensaje visible
