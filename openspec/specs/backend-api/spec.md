# backend-api Specification

## Purpose
Definir el contrato observable del backend propio de iManager: autenticacion, resolucion del contexto de negocio y modulos REST por dominio.
## Requirements
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

### Requirement: `/api/me` resuelve contexto de negocio completo
El endpoint `GET /api/me` SHALL devolver el objeto User, Store y StoreMember asociados al firebaseUid del token. Si el usuario no tiene Store, devuelve `{ onboardingRequired: true }`.

#### Scenario: Usuario con store existente
- **WHEN** se llama `GET /api/me` con un token válido de un usuario con store
- **THEN** responde `200` con `{ user, store, storeMember }`

#### Scenario: Usuario sin store
- **WHEN** se llama `GET /api/me` con un token válido de un usuario sin store en PG
- **THEN** responde `200` con `{ onboardingRequired: true }`

### Requirement: Módulos REST por dominio
El backend SHALL exponer módulos independientes en rutas `/api/<módulo>/`: inventory, clients, sales, trade-ins, onboarding. Cada módulo implementa las operaciones CRUD necesarias para su dominio.

#### Scenario: Request a módulo con storeMember válido
- **WHEN** un usuario autenticado con storeMember OWNER o STAFF llama a un endpoint de módulo
- **THEN** el módulo procesa la operación y responde con los datos del store del usuario

