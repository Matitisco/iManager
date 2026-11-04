## Why
El diálogo Basic del entorno test bloquea al agente de pruebas. Se reemplaza por un formulario HTML con las credenciales existentes.

## What Changes
Gate del servidor estático: login español, cookie firmada de 30 días, logout y compatibilidad Basic para CI. Sin variables nuevas ni cambios de producción.

## Capabilities
### New Capabilities
- `test-login-gate`: acceso al entorno test mediante formulario o Basic.

## Impact
Solo scripts del servidor estático, tests node:test y documentación. Sin cambios de schema Prisma.

## Non-goals
No cambiar Firebase, React/AppContext, Fastify/Prisma, secretos ni configuración de producción. No instalar dependencias ni ejecutar builds.
