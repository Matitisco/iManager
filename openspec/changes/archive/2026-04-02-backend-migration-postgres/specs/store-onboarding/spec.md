## ADDED Requirements

### Requirement: Onboarding crea Store y StoreMember OWNER
El sistema SHALL crear un Store y un StoreMember con rol OWNER cuando un usuario autenticado no tiene contexto de negocio en PG. El onboarding es el único mecanismo válido para crear este contexto.

#### Scenario: Usuario nuevo sin store
- **WHEN** un usuario se autentica y `/api/me` devuelve `onboardingRequired: true`
- **THEN** el frontend muestra el flujo de onboarding antes de acceder a la app

#### Scenario: Completar onboarding
- **WHEN** el usuario completa el formulario de onboarding con nombre de tienda
- **THEN** el sistema llama `POST /api/onboarding`, crea Store + StoreMember OWNER en PG, y redirige al core de la app

#### Scenario: Usuario existente con store
- **WHEN** un usuario con store existente se autentica
- **THEN** `/api/me` devuelve el contexto completo y el onboarding no se muestra

### Requirement: No se puede acceder al core sin contexto de negocio
El frontend SHALL bloquear el acceso a las páginas del core (Inventory, Sales, etc.) hasta que el usuario tenga un storeMember válido en PG.

#### Scenario: Acceso directo sin store
- **WHEN** un usuario sin store intenta navegar a una página del core
- **THEN** es redirigido al flujo de onboarding
