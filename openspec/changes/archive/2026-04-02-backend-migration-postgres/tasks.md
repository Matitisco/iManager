## 1. Backend Fastify + Prisma

- [x] 1.1 Crear proyecto `backend/` con Fastify, Prisma, Firebase Admin
- [x] 1.2 Definir schema Prisma: User, Store, StoreMember, Product, Client, Sale, TradeIn
- [x] 1.3 Configurar `prisma db push` en startup de Railway
- [x] 1.4 Implementar auth middleware: valida token Firebase, resuelve storeMember

## 2. Bridge de sesión

- [x] 2.1 Endpoint `GET /api/me` → devuelve User + Store + StoreMember
- [x] 2.2 Frontend: `backend-session.ts` llama `/api/me` al iniciar sesión
- [x] 2.3 AppContext: flag `backendConfigured`; si backend disponible, usar API en todos los módulos

## 3. Migración de módulos

- [x] 3.1 Módulo `clients`: CRUD en PG; script `migrate:clients` para datos de Firestore
- [x] 3.2 Módulo `inventory`: CRUD en PG (list, create, update, delete); servicio `inventory-api.ts`
- [x] 3.3 Módulo `sales`: CRUD transaccional en PG (muta stock + cliente); servicio `sales-api.ts`
- [x] 3.4 Módulo `trade-ins`: CRUD en PG por storeId; servicio `trade-ins-api.ts`
- [x] 3.5 Eliminar fallbacks silenciosos a Firestore en módulos migrados

## 4. Onboarding

- [x] 4.1 Endpoint `POST /api/onboarding` → crea Store + StoreMember OWNER
- [x] 4.2 Frontend: flujo de onboarding si `/api/me` devuelve `onboardingRequired: true`
- [x] 4.3 Script `bootstrap:owner` para crear primer OWNER manualmente en Railway

## 5. Deploy y validación

- [x] 5.1 Configurar Railway: variables de entorno DATABASE_URL, FIREBASE_*, PORT
- [x] 5.2 Fix: corregir entrypoint de start del backend
- [x] 5.3 Fix: add relación store-clients faltante en schema
- [x] 5.4 Fix: hardening de flujos de creación de entidades
