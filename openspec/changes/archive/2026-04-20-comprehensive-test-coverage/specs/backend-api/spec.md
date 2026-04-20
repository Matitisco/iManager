## MODIFIED Requirements

### Requirement: Auth middleware valida token Firebase en cada request
El backend SHALL validar el token Firebase JWT en el header `Authorization: Bearer <token>` antes de procesar cualquier request autenticado. Si el token es inválido o está expirado, responde `401 Unauthorized`. En `NODE_ENV=test`, el backend MAY aceptar tokens de prueba únicamente cuando `ENABLE_TEST_AUTH_BYPASS=true`, para ejecutar suites automatizadas sin Firebase real.

#### Scenario: Token válido
- **WHEN** el cliente envía un request con un token Firebase válido en el header Authorization
- **THEN** el middleware resuelve el `firebaseUid` y pasa al handler del módulo

#### Scenario: Token inválido o expirado
- **WHEN** el cliente envía un request con un token ausente, malformado o expirado
- **THEN** el backend responde `401` con mensaje de error; el frontend muestra error visible (sin fallback silencioso)

#### Scenario: Token de prueba habilitado en entorno test
- **WHEN** una suite automatizada corre con `NODE_ENV=test`, `ENABLE_TEST_AUTH_BYPASS=true` y envía un token de prueba válido
- **THEN** el middleware resuelve una identidad autenticada equivalente para continuar el flujo normal del backend

#### Scenario: Token de prueba fuera de entorno test
- **WHEN** el backend recibe un token de prueba con `NODE_ENV` distinto de `test` o sin `ENABLE_TEST_AUTH_BYPASS=true`
- **THEN** rechaza el request con `401` y no activa el bypass
