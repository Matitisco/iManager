## Why

La base actual de tests cubre utilidades y algunos casos puntuales, pero no protege los flujos críticos del sistema ni la matriz completa de endpoints del backend. Necesitamos una estrategia unificada que permita endurecer el producto, detectar regresiones antes del deploy y correr verificaciones repetibles en CI sin depender de Firebase real ni de Railway.

## What Changes

- Agregar infraestructura de testing explícita para frontend, backend y E2E con dependencias declaradas y scripts consistentes.
- Incorporar un seam de autenticación de prueba para `NODE_ENV=test` que permita correr integration tests y Playwright sin Firebase real.
- Crear helpers de base de datos de prueba, factories y reset determinista sobre PostgreSQL local/CI.
- Ampliar la cobertura del backend con tests unitarios de servicios y tests de integración con `buildApp()` + Postgres real.
- Ampliar la cobertura del frontend con tests unitarios/componentes para services, formularios, `Login`, `Onboarding`, `Modal`, `ConfirmModal` y `TableEngine`.
- Configurar Playwright para validar login, onboarding, inventario, ventas y canjes sobre un backend real de prueba.
- Extender GitHub Actions para correr lint, frontend tests, backend unit/integration y E2E en cada push y pull request.

## Capabilities

### New Capabilities
- `full-stack-test-suite`: Infraestructura y suites automatizadas para verificar backend, frontend, E2E y CI con auth bypass solo en test.

### Modified Capabilities
- `backend-api`: Agrega un modo autenticado de prueba acotado a `NODE_ENV=test` para ejecutar suites automatizadas sin depender de Firebase real.

## Impact

- Frontend: `src/context`, `src/services`, componentes core, formularios, setup de Vitest y tests de UI.
- Backend: `middleware`, `plugins`, `config`, servicios, rutas, setup de Vitest, helpers de test y suites unit/integration.
- Tooling/CI: `package.json`, `backend/package.json`, configs de Vitest, Playwright y `.github/workflows/ci.yml`.
- Dependencias nuevas: Testing Library, `jsdom`, `msw`, `@vitest/coverage-v8`, `@playwright/test`.

## Non-goals

- No cambiar el comportamiento funcional de producción fuera de habilitar seams estrictamente acotados a entorno `test`.
- No introducir build local ni alterar el flujo de deploy de Railway.
- No reescribir módulos demo como Dashboard o Notifications para subir cobertura artificialmente.
