## Why

El issue #62 del módulo Auth pide poder volver a usar el login o el registro después de cerrar el popup de Google. Firebase puede tardar varios segundos en rechazar el intento cancelado y durante ese intervalo el botón queda cargando.

## What Changes

- Liberar la carga visual de Google al volver a la ventana de login, sin esperar el rechazo diferido del SDK.
- Tratar el cierre y la cancelación de un popup como una cancelación normal.
- Aislar los intentos para que una respuesta tardía no altere la carga ni el error de un reintento.
- Cubrir login, registro, reintentos y errores reales con pruebas de regresión.

## Capabilities

### New Capabilities

- `google-login-recovery`: recuperación del formulario y aislamiento de intentos de Google.

### Modified Capabilities

Ninguna.

## Impact

Frontend: `src/pages/Login.tsx` y `src/pages/Login.test.tsx`. Sin cambios de API, dependencias ni schema Prisma. El acceso sigue dependiendo de Firebase y del contexto de sesión existente.

## Non-goals

- No implementar el código de registro del issue #63.
- No modificar el proveedor de autenticación ni el bootstrap del backend.
- No agrupar otros issues en este cambio.
