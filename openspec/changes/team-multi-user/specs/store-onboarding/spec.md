## MODIFIED Requirements

### Requirement: Onboarding detecta y maneja invitaciones pendientes
El flujo de Onboarding SHALL detectar si existe un parámetro `?invite=<token>` en la URL al montarse. Si existe, SHALL mostrar el modo invitación (ver spec `invite-onboarding`) en lugar del formulario de creación de tienda. Si no existe, el flujo de creación de tienda original no cambia.

#### Scenario: Onboarding sin token — flujo original intacto
- **WHEN** el Onboarding se monta sin `?invite` en la URL
- **THEN** muestra el formulario de creación de tienda (comportamiento existente sin cambios)

#### Scenario: Onboarding con token válido — flujo invitación
- **WHEN** el Onboarding se monta con `?invite=<token>` en la URL
- **THEN** no muestra el formulario de creación de tienda; muestra la pantalla de aceptación de invitación

#### Scenario: Onboarding con token inválido — fallback a creación
- **WHEN** el token en la URL es inválido o expirado
- **THEN** muestra un aviso de error y permite al usuario crear una tienda propia
