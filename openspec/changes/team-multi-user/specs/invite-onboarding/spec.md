## ADDED Requirements

### Requirement: Ruta de aceptación de invitación
El sistema SHALL proveer una ruta `/invite/:token` en el frontend que redirige al Onboarding con el token como query param (`?invite=<token>`). Esto permite compartir el enlace directamente.

#### Scenario: Usuario visita enlace de invitación sin sesión activa
- **WHEN** un usuario sin sesión de Firebase visita `/invite/:token`
- **THEN** se le redirige al login de Firebase con el token preservado en el state/redirect para retomarlo después del login

#### Scenario: Usuario visita enlace de invitación con sesión activa pero sin tienda
- **WHEN** un usuario con Firebase auth pero sin StoreMember visita `/invite/:token`
- **THEN** se muestra el Onboarding en modo "aceptar invitación" (no el modo "crear tienda")

#### Scenario: Usuario visita enlace de invitación con sesión y tienda existente
- **WHEN** un usuario ya tiene StoreMember activo y visita `/invite/:token`
- **THEN** se le muestra una pantalla de confirmación para unirse a la tienda adicional, separada del Onboarding principal

### Requirement: Onboarding en modo invitación
El sistema SHALL modificar el flujo de Onboarding para detectar el parámetro `?invite=<token>` en la URL. En modo invitación, en lugar de mostrar el formulario de creación de tienda, se muestra el nombre de la tienda a la que se va a unir y un botón de confirmación.

#### Scenario: Onboarding detecta token de invitación
- **WHEN** el Onboarding se monta con `?invite=<token>` en la URL
- **THEN** el componente llama a GET `/api/invitations/preview/:token` para obtener nombre de tienda e invitante, y muestra pantalla de confirmación

#### Scenario: Usuario confirma unirse a la tienda
- **WHEN** el usuario hace clic en "Unirme a [nombre de tienda]"
- **THEN** se llama a POST `/api/invitations/accept` con el token, y al éxito se recarga la sesión y se entra a la app

#### Scenario: Token inválido en Onboarding
- **WHEN** el token no existe o expiró
- **THEN** se muestra un mensaje de error "Esta invitación no es válida o ha expirado" con opción de crear una tienda propia

#### Scenario: Error al aceptar invitación
- **WHEN** el POST `/api/invitations/accept` falla
- **THEN** se muestra el error sin cerrar el Onboarding (no se simula éxito)

### Requirement: Preview de invitación sin autenticación completa
El sistema SHALL proveer un endpoint GET `/api/invitations/preview/:token` que retorna información básica de la invitación (nombre de tienda, rol asignado) sin requerir autenticación Firebase, para que el Onboarding pueda mostrar a qué tienda se va a unir el usuario antes de confirmar.

#### Scenario: Preview de token válido
- **WHEN** GET `/api/invitations/preview/:token` con token PENDING no expirado
- **THEN** retorna `{ storeName, role }` sin datos sensibles

#### Scenario: Preview de token inválido
- **WHEN** el token no existe, expiró, o no está en PENDING
- **THEN** retorna 404 o 410
