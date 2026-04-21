## Context

La base de código ya permite parametrizar la URL del backend en el frontend, pero Firebase web sigue viniendo de `firebase-applet-config.json` y el backend no trata `FRONTEND_URL` como parte formal del contrato de arranque. Eso deja demasiada superficie para errores de ambiente justo cuando `main` debe quedar como referencia de producción y `dev` pasa a ser la rama enlazada al entorno de desarrollo.

El cambio cruza frontend, backend y documentación operativa, pero no necesita migraciones ni nuevos servicios. El objetivo es volver explícita la configuración de cada entorno y reducir el riesgo de que el desarrollo toque datos reales.

## Goals / Non-Goals

**Goals:**
- Sacar la configuración Firebase web del camino runtime versionado y moverla a variables `VITE_*`.
- Hacer que el backend cargue `backend/.env` localmente y falle de forma explícita si falta `FRONTEND_URL` o una credencial crítica.
- Documentar la separación operacional entre `main`/producción y `dev`/desarrollo.
- Dejar una checklist concreta para la salida controlada del primer tester.

**Non-Goals:**
- No crear automatizaciones de deploy desde el repo.
- No crear infraestructura nueva de staging.
- No separar todavía Firebase/Auth en dos proyectos distintos.
- No tocar `AppContext.tsx` ni cambiar flujos de negocio.

## Decisions

### 1. `main` queda para producción y `dev` para desarrollo

La estrategia de ramas se documenta, no se codifica. `main` sigue representando la app productiva actual y `dev` concentra los cambios de entorno para el deploy de desarrollo enlazado a GitHub.

Se elige una rama estable (`dev`) en lugar de una rama efímera por tarea porque el deploy de desarrollo necesita un objetivo persistente.

### 2. El frontend resuelve Firebase web desde `VITE_*` con fail-fast

`src/firebase.ts` deja de importar `firebase-applet-config.json` y construye el config desde variables `VITE_FIREBASE_*`. Si falta una variable requerida, la app falla con un mensaje claro que enumera las claves faltantes.

Se agrega un override de test para Vitest porque el helper ahora valida en tiempo de inicialización y los tests necesitan un entorno controlado sin depender de secretos reales.

### 3. El backend carga `backend/.env` localmente y valida `FRONTEND_URL`

`backend/src/config/env.ts` usa `loadEnvFile` de Node para leer `backend/.env` cuando existe. `FRONTEND_URL` pasa a ser obligatorio en el schema y `invitations.service.ts` consume `env.FRONTEND_URL` en lugar de leer `process.env` directo.

Se mantiene además el guard explícito en invitaciones para que los tests y errores operativos sigan siendo legibles incluso ante mocks o configuraciones incompletas.

### 4. La preparación del tester se captura como checklist operativa

El repo no puede tomar snapshots de Railway ni crear cuentas reales sin acceso externo, así que esos pasos se documentan en una guía de entornos. La checklist cubre backup, validación de variables, onboarding del tester y la regla temporal de no mezclar cuentas dev/prod mientras Firebase siga compartido.

## Risks / Trade-offs

- [Firebase compartido temporalmente] -> Mitigación: documentar una regla operativa clara de no reutilizar cuentas/invitaciones entre `dev` y `main`.
- [Fail-fast en frontend] -> Mitigación: `.env.example`, tests de helper y README actualizados con todas las claves requeridas.
- [Drift entre `main` y `dev`] -> Mitigación: documentar el propósito de cada rama y dejar `main` como referencia productiva estable.
- [Cambio de contrato en backend] -> Mitigación: validar `FRONTEND_URL` al arrancar y cubrir invitaciones con tests.

## Migration Plan

1. Configurar el frontend local con `.env.local` y el backend local con `backend/.env`.
2. Configurar el deploy productivo para seguir `main` y el deploy de desarrollo para seguir `dev`.
3. Cargar variables productivas y de desarrollo en sus respectivos hosts antes de publicar.
4. Antes de la llamada con el tester, tomar snapshot de la DB productiva, validar la cuenta/store y revisar `DATABASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, Firebase Admin y SMTP.
5. Mantener Firebase compartido solo como solución transitoria hasta una futura iteración de split de auth.
