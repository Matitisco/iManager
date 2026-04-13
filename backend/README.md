# iManager API

Backend para iManager con Fastify, Prisma, PostgreSQL y Firebase Admin.

## Requisitos

- `DATABASE_URL`
- `FRONTEND_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIRESTORE_DATABASE_ID`

`FRONTEND_URL` debe apuntar al host real del frontend (por ejemplo `http://localhost:5173` en desarrollo o el dominio público en producción). El módulo de invitaciones usa esa variable para construir el enlace compartible y ahora falla de forma explícita si no está configurada.

## Scripts útiles

- `npm run dev` — arranca el backend en modo desarrollo
- `npm run lint` — chequeo TypeScript sin build
- `npm run bootstrap:owner -- --firebaseUid <uid>` — crea `Store` + `StoreMember` OWNER default para un usuario existente
- `npm run migrate:clients` — migra `clients` históricos desde Firestore a PostgreSQL

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

## Migración histórica de clients

El script lee la colección `clients` de Firestore, resuelve el `authorUid` contra `User.firebaseUid`, busca la `Store` por la membresía `default` y hace `upsert` por `storeId + dni`.

Si no encuentra usuario, membresía o `dni`, registra el caso y saltea el documento.

Ejecutar:

```bash
cd backend
npm run migrate:clients
```
