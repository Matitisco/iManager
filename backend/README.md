# iManager API

Backend para iManager con Fastify, Prisma, PostgreSQL y Firebase Admin.

## Requisitos

- `DATABASE_URL`
- `FRONTEND_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIRESTORE_DATABASE_ID`

`FRONTEND_URL` debe apuntar al host real del frontend (por ejemplo `http://localhost:5173` en desarrollo o el dominio publico en produccion). El modulo de invitaciones usa esa variable para construir el enlace compartible y falla de forma explicita si no esta configurada.

## Carga local de entorno

En desarrollo, el backend carga `backend/.env` automaticamente al arrancar. En produccion, `main` debe recibir estas variables desde Railway u otro host enlazado al deploy; no se versionan secretos reales.

### Matriz rapida

| Entorno | Rama | DATABASE_URL | FRONTEND_URL | CORS_ALLOWED_ORIGINS |
|---------|------|--------------|--------------|----------------------|
| Desarrollo | `dev` | PostgreSQL dev | host dev/local | host dev/local |
| Produccion | `main` | PostgreSQL prod | dominio publico | dominio publico |

## Scripts utiles

- `npm run dev` -> arranca el backend en modo desarrollo
- `npm run lint` -> chequeo TypeScript sin build
- `npm run bootstrap:owner -- --firebaseUid <uid>` -> crea `Store` + `StoreMember` OWNER default para un usuario existente
- `npm run migrate:clients` -> migra `clients` historicos desde Firestore a PostgreSQL

## Bootstrap inicial de tienda

El script de bootstrap busca el usuario por `firebaseUid` o por `email` en Firebase Auth y en Postgres.

Ejemplos:

```bash
cd backend
npm run bootstrap:owner -- --firebaseUid abc123 --storeName "iManager Store"
```

```bash
cd backend
npm run bootstrap:owner -- --email usuario@correo.com
```

## Migracion historica de clients

El script lee la coleccion `clients` de Firestore, resuelve el `authorUid` contra `User.firebaseUid`, busca la `Store` por la membresia `default` y hace `upsert` por `storeId + dni`.

Si no encuentra usuario, membresia o `dni`, registra el caso y saltea el documento.

Ejecutar:

```bash
cd backend
npm run migrate:clients
```

## Checklist previa al primer tester

- Tomar snapshot/backup de la DB productiva antes de la llamada.
- Verificar `DATABASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, Firebase Admin y SMTP en produccion.
- Crear o validar la cuenta del tester y su `Store`/`StoreMember OWNER` en produccion.
- Confirmar que las invitaciones y `/api/me` apunten al frontend de `main`, no al entorno `dev`.
