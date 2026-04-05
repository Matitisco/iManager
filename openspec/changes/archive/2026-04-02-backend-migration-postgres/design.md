## Context

El frontend usaba Firestore SDK directamente para todas las operaciones de negocio. Esto impedía transacciones, queries relacionales e integridad referencial. El objetivo era introducir un backend propio (Fastify) con Prisma sobre PostgreSQL en Railway, manteniendo Firebase Auth como proveedor de identidad.

## Goals / Non-Goals

**Goals:**
- Backend REST con auth middleware que valida tokens Firebase
- Prisma como ORM sobre PostgreSQL; Railway como host
- Módulos independientes por dominio: auth, clients, inventory, sales, trade-ins, onboarding
- Sin fallback silencioso: los módulos migrados nunca leen de Firestore

**Non-Goals:**
- No se reemplaza Firebase Auth (sigue siendo el proveedor de identidad)
- No se migra Dashboard, Reports, Notifications ni Settings
- No se implementa soft-delete ni auditoría

## Decisions

**1. Fastify sobre Express**
Fastify tiene mejor performance por defecto y schema validation built-in con `@fastify/ajv-compiler`. Alternativa (Express) descartada por overhead y ecosistema menos tipado.

**2. Prisma como ORM**
Type-safety completa desde el schema hasta el frontend. Alternativa (Drizzle) descartada por madurez del ecosistema al momento de la decisión.

**3. `prisma db push` en startup en Railway**
En lugar de `prisma migrate deploy`, se usa `db push` para simplificar el ciclo de deploy en desarrollo activo. Se migrará a `migrate deploy` cuando el schema se estabilice.

**4. Bridge `/api/me` como punto único de resolución de contexto**
Cada request del frontend primero valida el token Firebase y resuelve el contexto de negocio (User + Store + StoreMember). Esto centraliza la autenticación y evita que el frontend asuma contexto.

**5. Sin dual-write permanente**
Los módulos migrados solo escriben en PG. No hay sincronización back hacia Firestore.

## Risks / Trade-offs

- **Railway cold starts**: el backend puede tardar varios segundos en arrancar tras inactividad. Mitigación: retry automático en el frontend con backoff.
- **`prisma db push` en producción**: puede causar pérdida de datos si el schema cambia de forma destructiva. Mitigación: nunca usar `--force-reset`; revisar diffs antes de deploy.
- **Token expiry**: los tokens Firebase expiran a la hora. El frontend debe renovarlos antes de cada request. Mitigación: `fetch-with-timeout.ts` incluye lógica de refresco.

## Migration Plan

1. Deploy del backend en Railway (proyecto `efficient-magic`)
2. Script `bootstrap:owner` para crear el primer usuario OWNER en PG
3. Script `migrate:clients` para migrar datos históricos de Firestore → PG
4. Activar flag de backend en AppContext; probar en staging
5. Eliminar imports de Firestore SDK de los módulos migrados

## Open Questions

- ¿Cuándo migrar de `prisma db push` a `prisma migrate deploy`?
- ¿Se necesita rate limiting en la API antes de abrir a más tiendas?
