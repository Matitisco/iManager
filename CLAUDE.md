# iManager — Contexto para Claude Code

## Qué es este proyecto

Sistema de gestión para tiendas (POS/inventario/clientes/ventas). Stack:

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4
- **Backend**: Fastify + Prisma + Firebase Admin — desplegado en Railway (proyecto `efficient-magic`)
- **Base de datos**: PostgreSQL en Railway (fuente de verdad del negocio)
- **Auth**: Firebase Auth (Google + email/password)

## Estructura del repo

```
/                    → frontend (React+Vite)
  src/
    context/         → AppContext.tsx — bridge principal de sesión y CRUD
    services/        → clientes HTTP al backend (inventory-api, sales-api, etc.)
    modules/         → vistas por módulo
backend/             → API propia (Fastify + Prisma)
  src/
    modules/         → auth, clients, inventory, sales, trade-ins, onboarding, stores, users
  prisma/            → schema.prisma y migraciones
  scripts/           → bootstrap-owner, migrate-clients
```

## Flujo de sesión

1. Usuario se autentica con Firebase Auth → obtiene token
2. Frontend llama `/api/me` con el token
3. Backend valida token, resuelve `User + Store + StoreMember`
4. Si no hay contexto de negocio → `onboardingRequired` → pantalla de onboarding
5. Onboarding crea `Store` + `StoreMember` OWNER → desbloquea el core

## Módulos migrados a Postgres (backend real)

- `clients` — CRUD real
- `inventory` — CRUD real, unicidad por `storeId + imei`, categorías
- `sales` — transaccional, muta stock e inventario
- `trade-ins` — CRUD real filtrado por `storeId`

## Módulos aún en demo / pendiente

- `dashboard` y `reports` — demo, no consultan SQL real
- `notifications` — preview local
- `settings` — mezcla UI y placeholders

## Reglas que no se rompen

- **No hacer build** después de cambios (Railway hace el build en deploy)
- **No usar fallback silencioso a Firestore** en módulos ya migrados — si el backend falla, el usuario debe ver error real
- **No mezclar Firestore y Postgres** como fuentes activas del mismo dato
- **No cerrar modales como éxito** si la persistencia real falló
- **No asumir** que un usuario autenticado ya tiene contexto de negocio (puede necesitar onboarding)

## Comandos útiles

```bash
# Frontend
npm run dev          # dev server (puerto 5173 aprox)
npm run lint         # tsc --noEmit

# Backend (desde backend/)
npm run dev          # tsx watch src/server.ts
npm run lint         # tsc --noEmit
npm run bootstrap:owner   # crear owner inicial en Postgres
npm run migrate:clients   # migración histórica de clients desde Firestore
npx prisma studio    # UI de Postgres
```

## Servicios frontend → backend

| Archivo                        | Módulo        |
|-------------------------------|---------------|
| `src/services/inventory-api.ts`       | Inventario    |
| `src/services/inventory-import-api.ts` | Import XLSX  |
| `src/services/clients-api.ts`         | Clientes      |
| `src/services/sales-api.ts`           | Ventas        |
| `src/services/trade-ins-api.ts`       | Canjes        |
| `src/services/onboarding-api.ts`      | Onboarding    |
| `src/services/backend-session.ts`     | Sesión `/api/me` |

Todos usan `fetch-with-timeout.ts` (timeout 15s).

## Decisiones de diseño clave

- Firebase Auth se mantiene por pragmatismo (identidad) — Postgres es el negocio
- No dual-write permanente entre Firestore y Postgres
- Backend propio obligatorio para módulos migrados (no lógica sensible en frontend)
- Onboarding es la única forma válida de crear contexto de negocio para cuentas nuevas

## Estado actual (2026-04-04)

- Core estable y probado con datos reales
- Últimos features: categorías en inventario, rename inline, bulk-move, shift+click selection
- Pendiente: dashboard/reportes sobre SQL real, audit logs, hardening de settings
