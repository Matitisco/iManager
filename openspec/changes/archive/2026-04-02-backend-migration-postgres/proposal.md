## Why

La app usaba Firestore como fuente de datos de negocio, lo que impedía queries relacionales, transacciones reales y control de integridad. Se migró todo el stack a PostgreSQL (Railway) para tener una base de datos robusta y una API propia con Fastify + Prisma como única fuente de verdad.

## What Changes

- Nuevo backend Fastify en `backend/` con autenticación via Firebase Admin (valida tokens JWT)
- Bridge `/api/me` que resuelve User + Store + StoreMember desde PG
- Migración del slice de **Clients** de Firestore → PG (incluye script `migrate:clients`)
- Migración del slice de **Inventory** a PG (CRUD, delete, patch)
- Migración del slice de **Sales** a PG (transaccional: muta stock y cliente)
- Nuevo slice de **Trade-ins** en PG (CRUD por storeId)
- Flujo de **Onboarding** que crea Store + StoreMember OWNER en PG para cuentas nuevas
- Sin fallback silencioso a Firestore: si el backend falla, error visible al usuario

## Capabilities

### New Capabilities

- `backend-api`: API REST Fastify con auth middleware Firebase Admin y módulos por dominio
- `postgres-data-layer`: Prisma ORM sobre PostgreSQL como fuente de verdad del negocio
- `store-onboarding`: Flujo de creación de Store + StoreMember OWNER para nuevos usuarios

### Modified Capabilities

(ninguna — las capacidades anteriores basadas en Firestore fueron reemplazadas, no modificadas)

## Impact

- **backend/**: nuevo directorio completo (Fastify, Prisma, módulos, scripts)
- **src/context/AppContext.tsx**: integración con servicios HTTP en lugar de Firestore SDK
- **src/services/**: nuevos servicios `clients-api.ts`, `inventory-api.ts`, `sales-api.ts`, `trade-ins-api.ts`, `onboarding-api.ts`, `backend-session.ts`
- **Railway**: deploy automático del backend; `prisma db push` en startup

## Non-goals

- No se eliminó la dependencia de Firebase Auth (sigue siendo el proveedor de identidad)
- No se migró Dashboard, Reports, Notifications ni Settings a PG
- No se implementó soft-delete ni auditoría de cambios
