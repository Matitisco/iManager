---
description: Patrones y convenciones para cambios en backend/ de iManager (Fastify + Prisma + PostgreSQL + Firebase Admin)
---

# iManager Backend Skill

Aplicar esta skill antes de escribir cualquier código en `backend/`.

---

## Stack

- **Fastify** como HTTP server
- **Prisma** como ORM (PostgreSQL)
- **Firebase Admin** para verificar tokens JWT del frontend
- **TypeScript** strict
- Railway como plataforma de deploy

---

## Estructura de módulos

```
backend/src/modules/
  auth/        → /api/me — resolución de sesión
  onboarding/  → crear Store + StoreMember OWNER
  clients/     → CRUD de clientes
  inventory/   → CRUD de inventario + categorías
  sales/       → ventas (transaccional)
  trade-ins/   → canjes
  stores/      → gestión de tiendas
  users/       → usuarios internos
```

Cada módulo sigue la estructura:
```
{modulo}/
  routes.ts     → registra las rutas en Fastify
  service.ts    → lógica de negocio (llama a Prisma)
  schema.ts     → validación de request/response con Zod o JSON Schema
```

---

## Autenticación

Todo endpoint (excepto health) requiere token de Firebase Auth. El middleware de auth está centralizado:

```ts
// ✅ Así se protege una ruta
fastify.addHook('preHandler', verifyFirebaseToken);

// El hook agrega al request:
request.firebaseUid  // string
request.storeId      // string (resuelto desde StoreMember)
```

**No poner lógica de autenticación en los servicios** — solo en el middleware y las rutas.

---

## Patrón de servicio

```ts
// ✅ Patrón estándar
export async function getInventory(storeId: string): Promise<Product[]> {
  return prisma.product.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' }
  });
}
```

- Los servicios reciben `storeId` (nunca el `firebaseUid` directamente)
- El `storeId` se resuelve en la capa de ruta, desde `request.storeId`
- Los servicios no conocen nada de HTTP (no tocan `request`/`reply`)

---

## Prisma: schema y migraciones

El schema vive en `backend/prisma/schema.prisma`.

```bash
# Ver estado actual
npx prisma studio

# Aplicar cambios al schema (desarrollo)
npx prisma db push

# Generar migration formal (producción)
npx prisma migrate dev --name <nombre>
```

> **En Railway**: el backend corre `prisma db push` en el start hook automáticamente.

### Modelos clave

```prisma
User         → firebaseUid, email, displayName, avatarUrl
Store        → id, name
StoreMember  → userId, storeId, role (OWNER | ADMIN | SELLER)
Product      → storeId, imei (único por store), batteryHealth (String)
Sale         → storeId, productId, clientId, amount (transaccional)
TradeIn      → storeId, clientId
Client       → storeId, dni (único por store)
InventoryCategory → storeId, name
```

---

## Transaccionalidad

Sales muta múltiples tablas — siempre usar `prisma.$transaction`:

```ts
await prisma.$transaction(async (tx) => {
  const sale = await tx.sale.create({ data: saleData });
  await tx.product.update({ where: { id: sale.productId }, data: { status: 'VENDIDO' } });
  await tx.client.update({ where: { id: sale.clientId }, data: { totalSpent: { increment: sale.amount } } });
  return sale;
});
```

---

## Errores y respuestas

```ts
// 404
reply.status(404).send({ error: 'Not found' });

// 400
reply.status(400).send({ error: 'storeId required' });

// Error de Prisma: unique constraint
if (error.code === 'P2002') {
  reply.status(409).send({ error: 'Ya existe un registro con ese IMEI en esta tienda' });
}
```

---

## Variables de entorno

```
DATABASE_URL              → PostgreSQL connection string (Railway)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY      → con newlines escapados como \n
FIRESTORE_DATABASE_ID     → nombre del database de Firestore (no default)
```

---

## Lo que NO hacer

- No poner lógica de negocio en `routes.ts` — va en `service.ts`
- No acceder a `firebaseUid` en los servicios — solo en el middleware
- No mezclar Firestore como fuente de datos para módulos ya migrados
- No hacer `prisma.xyz.findMany()` sin filtrar por `storeId`
- No usar `npm run build` manualmente — Railway lo hace en deploy
- No commitear variables de entorno sensibles
