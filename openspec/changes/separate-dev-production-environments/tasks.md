## 1. Frontend

- [x] 1.1 Reemplazar el config Firebase versionado por un helper basado en `VITE_FIREBASE_*` con error explícito y cobertura de tests.
- [x] 1.2 Extender `src/vite-env.d.ts` y `.env.example` para reflejar el contrato real del frontend en desarrollo y producción.

## 2. Backend

- [x] 2.1 Cargar `backend/.env` automáticamente en desarrollo y hacer obligatorio `FRONTEND_URL` en `backend/src/config/env.ts`.
- [x] 2.2 Actualizar invitaciones para usar el env validado y cubrir con tests el armado de URLs por entorno.

## 3. Documentación y validación

- [x] 3.1 Documentar la estrategia `main`/producción y `dev`/desarrollo, las matrices de variables y la checklist del primer tester.
- [x] 3.2 Ejecutar lint y los tests relevantes de frontend/backend, y dejar los artefactos OpenSpec marcados como completos.
