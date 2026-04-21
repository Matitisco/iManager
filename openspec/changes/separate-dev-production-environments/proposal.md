## Why

iManager ya tiene módulos core operando sobre PostgreSQL, pero la configuración de entornos todavía mezcla señales de template, un JSON Firebase versionado en el frontend y un contrato incompleto en el backend. Con el primer tester entrando a producción, necesitamos separar el trabajo diario de desarrollo de la operación real sin tocar la app actual que vive en `main`.

## What Changes

- Mover la configuración runtime del frontend a variables `VITE_*` para API y Firebase web.
- Validar `FRONTEND_URL` como parte obligatoria del backend y cargar `backend/.env` automáticamente en desarrollo.
- Documentar una estrategia operativa simple: `main` para producción y `dev` para desarrollo, con matrices de variables por entorno.
- Agregar una guía de salida controlada para el tester mientras Firebase Auth sigue compartido temporalmente.

## Non-goals

- No crear un staging público en esta iteración.
- No separar todavía Firebase/Auth en proyectos distintos.
- No automatizar backups, creación de cuentas tester ni deploys enlazados a GitHub dentro del repo.
- No cambiar el schema de Prisma.

## Capabilities

### New Capabilities
- `deployment-environments`: configuración explícita de frontend/backend para desarrollo y producción, con contrato fail-fast y guía operativa de ramas.

### Modified Capabilities

## Impact

- Frontend: `src/firebase.ts`, `src/vite-env.d.ts`, setup/tests relacionados con auth.
- Backend: `backend/src/config/env.ts`, `backend/src/modules/invitations/invitations.service.ts` y sus tests.
- Documentación y operación: `.env.example`, `backend/.env.example`, `README.md`, `backend/README.md`, `PROJECT_STATUS.md`, nueva guía de entornos.
