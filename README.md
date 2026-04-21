# iManager

Panel de gestion POS para tiendas de celulares y dispositivos.

---

## Que es

iManager es una app de gestion para tiendas de celulares. Maneja:

- Inventario por IMEI (condicion, bateria, categorias, columnas custom)
- Ventas (transaccional: muta stock y totales del cliente)
- Clientes con historial de compras
- Canjes / trade-ins
- Import de inventario desde CSV/XLSX
- Auth multi-proveedor (Google + email/password)

---

## Stack

| Capa | Tecnologia |
|------|------------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Backend | Fastify + Prisma + Firebase Admin (Railway) |
| Base de datos | PostgreSQL en Railway |
| Auth | Firebase Authentication |
| Deploy | Backend en Railway; frontend segun host enlazado a GitHub |

---

## Estado actual (2026-04-20)

Los modulos core (inventory, clients, sales, trade-ins) estan en produccion sobre PostgreSQL.
Dashboard, Notifications y Settings siguen parciales o demo.

Ver `PROJECT_STATUS.md` para el estado detallado y el roadmap.

---

## Como correr el proyecto

```bash
# Frontend
npm install
npm run dev       # http://localhost:5173
npm run lint      # tsc --noEmit

# Backend (desde backend/)
npm install
npm run dev       # tsx watch src/server.ts
npm run lint
npx prisma studio # UI de PostgreSQL
```

## Ramas y entornos

- `main` -> rama de produccion. Debe seguir representando la app estable que usa la tienda real.
- `dev` -> rama de desarrollo. Usala para el deploy de desarrollo enlazado a GitHub y para validar cambios sin tocar produccion.

La separacion actual es:

```text
Desarrollo
dev branch -> frontend dev host -> backend local/dev -> Postgres dev
                                   \
                                    -> Firebase actual (compartido temporalmente)

Produccion
main branch -> frontend publico -> Railway API actual -> Postgres prod
                                    \
                                     -> Firebase actual
```

### Variables de entorno

**Frontend (`.env.local`):**

```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MEASUREMENT_ID=
```

**Backend (`backend/.env`):**

```bash
DATABASE_URL=postgresql://.../imanager_dev
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIRESTORE_DATABASE_ID=...
```

En produccion, esas variables deben cargarse desde el host enlazado al deploy, no desde archivos versionados.

Ver [docs/environment-setup.md](/Users/matis/Desktop/iManager/docs/environment-setup.md) para la matriz completa de variables, la estrategia `main`/`dev` y la checklist previa al primer tester.

---

## Flujo de sesion

```text
Firebase Auth -> JWT -> /api/me -> User + Store + StoreMember
  -> onboardingRequired?
     Si -> pantalla de onboarding -> crea Store + StoreMember OWNER
     No -> app core
```

---

## Documentacion para agentes AI

Si sos un agente empezando a trabajar en este repo:

1. `AGENTS.md` -> onboarding completo: stack, modulos, reglas, skills
2. `PROJECT_STATUS.md` -> estado vivo, roadmap, issues conocidos
3. `openspec/AGENTS.md` -> flujo OpenSpec y specs activos
4. `skills/` -> skills por area (frontend, backend, inventory, etc.)

---

## Reglas clave

- No hacer build manual (Railway hace el build en deploy)
- Los modulos migrados no usan fallback silencioso a Firestore
- Backend propio es obligatorio para toda logica de negocio
- Un usuario autenticado puede necesitar onboarding antes de usar el core
- Mientras Firebase siga compartido, no mezclar cuentas o invitaciones de desarrollo con produccion
