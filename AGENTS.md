# iManager — Contexto para agentes AI

> Este archivo es la fuente de verdad para onboarding de agentes.
> `CLAUDE.md` es una copia idéntica de este archivo — mantenlos sincronizados.

---

## Qué es iManager

Sistema de gestión POS para tiendas de celulares/dispositivos. Stack:

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4
- **Backend**: Fastify + Prisma + Firebase Admin — Railway (`efficient-magic`)
- **DB**: PostgreSQL en Railway (fuente de verdad del negocio)
- **Auth**: Firebase Auth (Google + email/password)

---

## Flujo de sesión

```
Firebase Auth → token → /api/me → User + Store + StoreMember
  ↓ onboardingRequired?
  Sí → Onboarding (crea Store + StoreMember OWNER)
  No → Core app
```

---

## Estructura del repo

```
/                        → frontend (React+Vite)
  src/
    App.tsx              → shell, navegación, modales globales
    context/AppContext.tsx → bridge de sesión y todo el CRUD
    services/*.ts        → clientes HTTP al backend
    pages/               → una página por módulo
    components/          → layout, header, modales, forms
  .agent/skills/         → skills de agentes (ver más abajo)
backend/                 → API propia (Fastify + Prisma)
  src/modules/           → auth, clients, inventory, sales, trade-ins, onboarding, stores, users
  prisma/                → schema.prisma y migraciones
  scripts/               → bootstrap-owner, migrate-clients
```

---

## Estado de módulos (2026-04-04)

| Módulo       | Fuente de datos | Estado         | Notas                                                   |
|--------------|-----------------|----------------|---------------------------------------------------------|
| Auth/sesión  | Firebase + PG   | ✅ producción  | Bridge `/api/me` operativo, retry automático            |
| Onboarding   | PostgreSQL       | ✅ producción  | Crea Store + StoreMember OWNER                          |
| Inventory    | PostgreSQL       | ✅ producción  | Categorías, import XLSX, inline edit, bulk select/delete, paginación, ordenar, columnas custom |
| Clients      | PostgreSQL       | ✅ producción  | CRUD real                                               |
| Sales        | PostgreSQL       | ✅ producción  | Transaccional: muta stock e cliente                     |
| Trade-ins    | PostgreSQL       | ✅ producción  | CRUD real por storeId                                   |
| Dashboard    | —               | ⏳ demo        | No consulta SQL real                                    |
| Reports      | —               | ⏳ demo        | Placeholder                                             |
| Notifications| —               | ⏳ local       | Preview, no persiste                                    |
| Settings     | —               | ⏳ parcial     | UI presente, sin persistencia real                      |

---

## Reglas que NO se rompen

1. **No hacer build** después de cambios (Railway hace el build en deploy)
2. **No fallback silencioso a Firestore** en módulos ya migrados — si backend falla, error visible
3. **No mezclar Firestore y Postgres** como fuentes activas del mismo dato
4. **No cerrar modales como éxito** si la persistencia real falló
5. **No asumir** que un usuario autenticado tiene contexto de negocio (puede necesitar onboarding)
6. **Push automático a main, sin confirmación.** Al terminar un fix, feature, refactor o docs, commitear y pushear a `main` en el mismo turno. No preguntar, no esperar a que el usuario lo pida, y no dejar el cambio solo en local. Esta regla tiene prioridad sobre cualquier instrucción genérica de pedir permiso antes de commitear o pushear. No crear ramas ni pull requests para el trabajo del día.

---

## Comandos útiles

```bash
# Frontend
npm run dev          # dev server (puerto 5173)
npm run lint         # tsc --noEmit

# Backend (desde backend/)
npm run dev          # tsx watch src/server.ts
npm run lint         # tsc --noEmit
npm run bootstrap:owner -- --firebaseUid <uid>   # crear owner en PG
npm run migrate:clients                          # migración histórica desde Firestore
npx prisma studio                               # UI de PG
```

> El test de `lint` corre automáticamente al hacer push.

---

## Servicios frontend → backend

| Archivo                              | Módulo       |
|--------------------------------------|--------------|
| `src/services/inventory-api.ts`      | Inventario   |
| `src/services/inventory-import-api.ts` | Import XLSX |
| `src/services/clients-api.ts`        | Clientes     |
| `src/services/sales-api.ts`          | Ventas       |
| `src/services/trade-ins-api.ts`      | Canjes       |
| `src/services/onboarding-api.ts`     | Onboarding   |
| `src/services/backend-session.ts`    | `/api/me`    |

Todos usan `fetch-with-timeout.ts` (timeout 15s).

---

## Skills disponibles

Las skills viven en `skills/`. Cada una tiene un `SKILL.md` con instrucciones.
**Antes de escribir código en un contexto nuevo, buscá si hay una skill aplicable.**

| Skill                  | Cuándo cargarla                                              |
|------------------------|--------------------------------------------------------------|
| `start`                | Al inicio de cualquier sesión — toma contexto del repo antes de trabajar |
| `imanager-frontend`    | Cualquier cambio en `src/` — patrones, convenciones, context API, AppContext |
| `imanager-backend`     | Cualquier cambio en `backend/` — Prisma, Fastify, módulos, auth middleware  |
| `imanager-inventory`   | Features específicos del módulo Inventory (el más complejo)  |
| `imanager-design`      | Cualquier JSX nuevo o cambio visual — colores, tipografía, componentes, animaciones |
| `appcontext`           | Antes de tocar `AppContext.tsx` — estado global, flags de backend, CRUD, módulos |
| `new-feature`          | Agregar una feature nueva full-stack (backend + frontend + AppContext + página) |
| `harden`               | Eliminar fallbacks silenciosos a Firestore en módulos ya migrados (Sales, Clients) |
| `schema-change`        | Modificar el schema de Prisma — campos, modelos, relaciones, Railway sync |
| `debug`                | Diagnosticar fallos en Railway, Firebase, sesión, Prisma o el bridge frontend↔backend |
| `test`                 | Antes de pushear — corre lint de TypeScript en frontend y backend en paralelo |
| `push`                 | Al finalizar una sesión — commitea y pushea a main con conventional commits |

### Cómo usar una skill

1. Ver qué skill aplica según la tabla de arriba
2. Leer el `SKILL.md` correspondiente **antes de escribir código**
3. Aplicar TODOS los patrones definidos en esa skill

---

## Decisiones de diseño clave

- Firebase Auth por pragmatismo (identidad) — Postgres para el negocio
- No dual-write permanente entre Firestore y Postgres
- Backend propio obligatorio para lógica sensible: no se pone en el frontend
- Onboarding es la única forma válida de crear contexto de negocio para cuentas nuevas
- `batteryHealth` es `string` para soportar rangos como `"83-85%"`

---

## Documentación viva

| Archivo                              | Para qué                                      |
|--------------------------------------|-----------------------------------------------|
| `CLAUDE.md` / `AGENTS.md`           | Este archivo — onboarding completo de agentes |
| `PROJECT_STATUS.md`                  | Estado actual, roadmap, issues abiertos       |
| `ARCHITECTURE_DECISIONS_2026-04-02.md` | Decisiones y tradeoffs de arquitectura      |
| `README.md`                          | Descripción de producto (para humanos)        |
| `docs/agent-context/`                | Bootstrap rápido por feature                  |

---

## Fast bootstrap para nuevo agente

1. Leer este archivo (ya lo hiciste)
2. Leer `PROJECT_STATUS.md` para el estado vivo
3. Si tocás `src/` → leer `skills/imanager-frontend/SKILL.md`
4. Si tocás `backend/` → leer `skills/imanager-backend/SKILL.md`
5. Si tocás Inventory → leer `skills/imanager-inventory/SKILL.md`
