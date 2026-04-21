# iManager Environment Setup

## Estrategia actual

- `main` representa produccion.
- `dev` representa desarrollo.
- El deploy productivo debe seguir `main`.
- El deploy de desarrollo debe seguir `dev`.

No hay staging publico en esta iteracion.

## Mapa de entornos

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

## Frontend

### Desarrollo (`.env.local`)

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

### Produccion (host enlazado a `main`)

Configurar las mismas variables `VITE_*` en el proveedor del frontend apuntando al backend/API y al proyecto Firebase web de produccion actual.

## Backend

### Desarrollo (`backend/.env`)

```bash
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/imanager_dev
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIRESTORE_DATABASE_ID=...
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### Produccion (`main`)

Configurar estas variables en Railway o en el host del backend:

- `DATABASE_URL`: PostgreSQL productivo
- `FRONTEND_URL`: dominio publico del frontend
- `CORS_ALLOWED_ORIGINS`: dominio publico del frontend
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIRESTORE_DATABASE_ID`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` si usan invitaciones/2FA

## Regla temporal mientras Firebase siga compartido

- Solo cuentas internas en `dev`
- Solo cuentas reales de tienda/tester en `main`
- No reutilizar invitaciones ni usuarios de prueba entre desarrollo y produccion

## Checklist previa al primer tester

1. Tomar snapshot/backup de la DB productiva.
2. Verificar `DATABASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, Firebase Admin y SMTP en produccion.
3. Crear o validar la cuenta del tester y su `Store`/`StoreMember OWNER`.
4. Confirmar que `Firebase Auth -> /api/me -> onboarding/store` apunta a produccion.
5. Confirmar que cualquier invitacion generada devuelve links del frontend productivo.
