# iManager API

Backend para iManager con Fastify, Prisma, PostgreSQL y Firebase Admin.

## Requisitos

- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Scripts útiles

- `npm run dev` — arranca el backend en modo desarrollo
- `npm run lint` — chequeo TypeScript sin build
- `npm run migrate:clients` — migra `clients` históricos desde Firestore a PostgreSQL

## Migración histórica de clients

El script lee la colección `clients` de Firestore, resuelve el `authorUid` contra `User.firebaseUid`, busca la `Store` por la membresía `default` y hace `upsert` por `storeId + dni`.

Si no encuentra usuario, membresía o `dni`, registra el caso y saltea el documento.

Ejecutar:

```bash
cd backend
npm run migrate:clients
```
