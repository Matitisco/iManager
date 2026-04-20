## ADDED Requirements

### Requirement: Backend test harness determinista
El sistema MUST proveer infraestructura de test backend que permita ejecutar tests unitarios e integration con PostgreSQL real de prueba, auth bypass acotado a `NODE_ENV=test` y helpers compartidos de seed/reset.

#### Scenario: Integration test autenticado sin Firebase real
- **WHEN** una suite backend corre con `NODE_ENV=test` y `ENABLE_TEST_AUTH_BYPASS=true`
- **THEN** puede autenticar requests contra `buildApp()` usando tokens de prueba
- **AND** el middleware sigue rechazando requests sin credenciales o con credenciales de prueba malformadas

#### Scenario: Reset de base de datos entre pruebas
- **WHEN** una suite integration o E2E necesita aislar un caso de prueba
- **THEN** dispone de helpers para limpiar tablas y sembrar fixtures sobre Postgres real sin usar Railway ni datos compartidos

### Requirement: Frontend test suite cubre componentes y servicios críticos
El sistema MUST proveer tests de frontend para services, formularios, páginas críticas y componentes core usando Vitest con `jsdom`, Testing Library y dobles de red/auth controlados.

#### Scenario: Login y onboarding bajo auth adapter de prueba
- **WHEN** una suite de frontend o E2E corre con `VITE_TEST_AUTH_MODE=e2e`
- **THEN** `Login`, `Onboarding` y `AppContext` operan sin depender de Firebase real
- **AND** el flujo sigue usando `/api/me` y el backend como fuente de verdad del contexto de negocio

#### Scenario: TableEngine cubierto con interacciones críticas
- **WHEN** la suite de componentes ejecuta tests sobre `TableEngine`
- **THEN** valida carga, filtros, sort, selección múltiple, inline edit, bulk actions, add row, categorías y acciones de columnas

### Requirement: E2E valida flujos críticos completos
El sistema MUST ejecutar al menos un test E2E por flujo crítico de login, onboarding, inventario, venta y canje sobre frontend y backend reales de prueba.

#### Scenario: Venta end-to-end
- **WHEN** un test E2E crea una venta desde la UI
- **THEN** la venta se persiste en Postgres de prueba
- **AND** el stock del inventario y los datos relacionados quedan actualizados acorde al flujo real

#### Scenario: Onboarding end-to-end
- **WHEN** un usuario autenticado de prueba no tiene membresía
- **THEN** la UI muestra onboarding
- **AND** al completarlo se crea `Store + StoreMember OWNER` y se desbloquea el core

### Requirement: CI ejecuta la matriz automática en cada push
El sistema MUST ejecutar lint, tests frontend, backend unit, backend integration y E2E en cada push y pull request.

#### Scenario: Push a rama del repositorio
- **WHEN** se dispara GitHub Actions por `push` o `pull_request`
- **THEN** el workflow levanta Postgres de prueba, instala dependencias necesarias y corre toda la matriz definida
- **AND** falla si los tests backend no alcanzan el threshold de cobertura configurado
