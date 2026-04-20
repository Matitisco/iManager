## 1. OpenSpec and test infrastructure

- [x] 1.1 Declarar dependencias de testing en `package.json` y `backend/package.json`
- [x] 1.2 Separar configs/scripts de Vitest para frontend, backend unit, backend integration y coverage
- [x] 1.3 Crear helpers compartidos de DB/auth/fixtures para suites backend y E2E

## 2. Backend test seam and backend coverage

- [x] 2.1 Implementar auth bypass acotado a `NODE_ENV=test` y lazy init de Firebase Admin
- [x] 2.2 Agregar unit tests para servicios y middleware críticos del backend
- [x] 2.3 Agregar integration tests con Postgres real para endpoints y flujos del backend
- [x] 2.4 Configurar threshold de cobertura backend `>= 80%` sobre servicios y middleware

## 3. Frontend test harness and component coverage

- [x] 3.1 Introducir `AuthAdapter` y adaptar explícitamente `AppContext.tsx` para modo `e2e`
- [x] 3.2 Tipar services frontend contra un usuario autenticado genérico y agregar tests unitarios de services
- [x] 3.3 Agregar tests de componentes/páginas para `Modal`, `ConfirmModal`, `Login`, `Onboarding` y formularios core
- [x] 3.4 Agregar tests de `TableEngine` para filtros, sort, selección, inline edit, bulk actions, categorías y columnas

## 4. E2E and CI

- [x] 4.1 Configurar Playwright con frontend y backend reales de prueba
- [x] 4.2 Implementar flujos E2E de login, onboarding, inventario, venta y canje
- [x] 4.3 Extender GitHub Actions para correr lint, frontend tests, backend unit, backend integration y E2E
- [x] 4.4 Validar la suite final, actualizar artifacts y dejar el change listo para archive
