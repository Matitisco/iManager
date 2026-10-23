## Why
El gate de PR ejecuta suites completas de frontend/backend aunque solo cambie un módulo. Reducir el tiempo hasta main seleccionando pruebas relacionadas sin debilitar el check requerido.

## What Changes
- Selección por diff del merge-base del PR, Vitest related y respaldo completo ante cambios globales o borrados.
- Smoke E2E/PWA solo ante UI, rutas frontend, assets o infraestructura compartida.
- Lint/TypeScript siempre; conservar suites completas en push main, nightly y dispatch y el agregador test.

## Capabilities
### New Capabilities
- `ci-selection`: planificación verificable de pruebas por archivos modificados.

## Impact
CI de todos los módulos; sin cambios de negocio, AppContext ni schema Prisma.

## Non-goals
No modificar suites ni protección de ramas, ni optimizar deploys.
