## Context

iManager ya tiene `vitest` en frontend y backend, pero la configuración es mínima, las dependencias de testing del frontend no están declaradas en `package.json`, no existe E2E y el backend depende de Firebase Admin incluso para pruebas. Además, `AppContext.tsx` todavía enlaza directamente Firebase Auth y suscripciones Firestore, lo que vuelve frágiles los tests end-to-end y dificulta correr suites aisladas en CI.

El cambio es transversal: toca configuración, autenticación, infraestructura de base de datos de prueba, servicios backend, componentes frontend y pipeline de GitHub Actions. También necesita un enfoque que no modifique la semántica de producción.

## Goals / Non-Goals

**Goals:**
- Declarar y configurar una infraestructura de tests reproducible para frontend, backend y E2E.
- Permitir autenticación determinista en test sin requerir Firebase real ni secretos productivos.
- Ejecutar integration tests del backend contra Postgres real con reset/seed controlado.
- Cubrir los flujos críticos del frontend y backend con suites automatizadas mantenibles.
- Ejecutar toda la matriz relevante en CI en cada push/PR.

**Non-Goals:**
- Reemplazar Firebase Auth en producción.
- Cambiar la fuente de verdad del negocio o agregar nuevos módulos funcionales.
- Imponer threshold global de cobertura de frontend en esta primera entrega.

## Decisions

### 1. AuthAdapter en frontend con modo `firebase` y modo `e2e`
Se introduce una capa `AuthAdapter` para desacoplar `AppContext` de Firebase Auth directo. En producción seguirá usando Firebase; en test/E2E usará un adapter local basado en `localStorage` y eventos del navegador.

Alternativas consideradas:
- Mockear Firebase entero desde Playwright: demasiado frágil y acoplado a internals del SDK.
- Usar Firebase real para E2E: más lento, dependiente de credenciales externas y menos determinista.

### 2. Auth bypass en backend solo con `NODE_ENV=test`
`authenticate` aceptará tokens de prueba firmados de forma simple (`test.<payload>`) únicamente cuando `NODE_ENV=test` y `ENABLE_TEST_AUTH_BYPASS=true`. En cualquier otro entorno seguirá verificando Firebase Admin.

Alternativas consideradas:
- Rutas paralelas sin auth: abren demasiada superficie y no ejercitan el middleware real.
- Mockear middleware por test: sirve para unit tests, pero no para integration/E2E reales.

### 3. Inicialización lazy de Firebase Admin
Firebase Admin dejará de inicializarse obligatoriamente al cargar módulos. El plugin resolverá Auth/Firestore bajo demanda para permitir suites de test sin secrets reales.

Alternativas consideradas:
- Mockear `env.ts` o `firebase-admin.ts` en cada suite: repetitivo y propenso a drift.

### 4. Postgres real de prueba con helpers compartidos
Las suites integration del backend y Playwright compartirán helpers para resetear tablas, seedear usuarios/stores/categorías y construir headers de auth test. Se usará la misma app Fastify (`buildApp`) en vez de servidores paralelos específicos de test.

Alternativas consideradas:
- Mocks de Prisma para integration: no cubren SQL real ni side effects.
- Usar Railway test DB: rompe aislamiento y agrega dependencia externa.

### 5. Vitest separado por responsabilidad
Frontend usará un solo config con `jsdom` para `*.test.tsx` y `node` para `*.test.ts`; backend tendrá configs separados para unit e integration y un script de cobertura para servicios/middleware.

Alternativas consideradas:
- Un único config monolítico para todo: complica setup, tiempos y aislamiento.

### 6. Playwright sobre app real + backend real + auth bypass
Playwright levantará el frontend dev server y el backend en puerto separado, inyectando `VITE_TEST_AUTH_MODE=e2e`, `VITE_API_BASE_URL` y el bypass de auth. Los tests sembrarán datos desde Node usando Prisma helpers.

Alternativas consideradas:
- Browser mode de Vitest: útil para componentes, insuficiente para flujos completos del sistema.

## Risks / Trade-offs

- [Riesgo] `AppContext` sigue siendo grande y difícil de testear directamente. → Mitigación: cubrir seams visibles (`AuthAdapter`, services y páginas core) y usar E2E para integración completa.
- [Riesgo] Suites integration/E2E más lentas en CI. → Mitigación: separar scripts, reset liviano de DB y reutilizar servidores cuando sea posible.
- [Riesgo] El auth bypass podría filtrarse a producción. → Mitigación: gate doble por `NODE_ENV=test` y `ENABLE_TEST_AUTH_BYPASS=true`, más tests que aseguren rechazo fuera de ese contexto.
- [Riesgo] Formularios/componentes legacy sin selectores robustos. → Mitigación: agregar `data-testid` solo a puntos inestables y priorizar queries semánticas.

## Migration Plan

1. Crear artifacts OpenSpec del cambio y dejar definidos los bloques de implementación.
2. Declarar dependencias y configs de test, junto con helpers compartidos de DB/auth.
3. Implementar auth bypass backend + AuthAdapter frontend y adaptar `AppContext`.
4. Ampliar suites unit/integration del backend y fijar el gate de cobertura.
5. Ampliar suites unit/component del frontend.
6. Agregar Playwright, seeds E2E y pipeline de CI.
7. Validar con lint + tests relevantes y ajustar tasks OpenSpec.

## Open Questions

- Ninguna bloqueante para esta entrega; el alcance y la estrategia de auth bypass quedaron definidos en el plan aprobado.
