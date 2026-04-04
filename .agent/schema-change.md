---
description: Receta para modificar el schema de Prisma de forma segura — agregar campos, modelos o relaciones manteniendo sincronizados backend, frontend y Railway.
---

# Schema Change — Modificar el schema de Prisma

Usar cuando se necesita agregar o modificar modelos, campos o relaciones en la base de datos.

---

## El stack completo que se toca

```
backend/prisma/schema.prisma
  ↓ prisma db push (local) / automático en Railway
backend/src/modules/[módulo]/service.ts   ← interfaces Input/Response + serializer
src/types.ts                               ← tipo frontend
src/services/[módulo]-api.ts              ← payload si hay campos nuevos enviados
```

---

## Paso 1: Editar `backend/prisma/schema.prisma`

### Agregar un campo a un modelo existente

```prisma
model InventoryItem {
  // campos existentes ...
  notes  String?  @db.Text   // ← nuevo campo opcional
}
```

**Convenciones del proyecto:**
- Strings cortos (nombres, enums): `@db.VarChar(N)` — elegir N apropiado
- Texto largo: `@db.Text`
- Números monetarios: `Decimal @db.Decimal(12, 2)`
- Campos opcionales: `String?` (null en DB)
- Relaciones 1-N: `onDelete: Cascade` para registros hijos, `onDelete: SetNull` para FK opcionales
- Siempre agregar `@@index([storeId])` en modelos nuevos
- Unicidades por tienda: `@@unique([storeId, campo])`

### Agregar un modelo nuevo

```prisma
model Widget {
  id        String   @id @default(cuid())
  storeId   String
  name      String   @db.VarChar(120)
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([storeId])
}
```

Y agregar la relación inversa en `Store`:
```prisma
model Store {
  // ...
  widgets Widget[]
}
```

---

## Paso 2: Aplicar el schema

### Desarrollo local

```bash
cd backend
npx prisma db push
```

`db push` aplica los cambios directamente sin crear archivos de migración. Es lo que se usa en este proyecto.

### En Railway (producción)

Railway ejecuta `prisma db push` automáticamente en el start hook del deploy. No hay acción manual requerida.

> Si el campo es `NOT NULL` sin default y ya hay filas, `db push` fallará.
> Siempre agregar un default o hacerlo opcional (`?`) si puede haber datos existentes.

---

## Paso 3: Actualizar el service del backend

### Si agregaste un campo a un modelo existente

Hay tres lugares a actualizar en `service.ts`:

**1. Interface `XInput`** (lo que recibe el endpoint):
```ts
export interface WidgetInput {
  name: string;
  notes?: string;  // ← agregar si el frontend lo puede enviar
}
```

**2. Interface `XResponse`** (lo que devuelve el endpoint):
```ts
export interface WidgetResponse {
  id: string;
  name: string;
  notes: string | null;  // ← agregar
}
```

**3. Función `serializeX`**:
```ts
function serializeWidget(record: any): WidgetResponse {
  return {
    id: record.id,
    name: record.name,
    notes: record.notes ?? null,  // ← agregar
  };
}
```

**4. Función `createX`** / **`updateX`** si el campo es escribible:
```ts
const item = await prisma.widget.create({
  data: {
    storeId,
    name: input.name,
    notes: input.notes ?? null,  // ← agregar
  },
});
```

---

## Paso 4: Actualizar el tipo frontend en `src/types.ts`

```ts
export interface Widget {
  id: string;
  name: string;
  notes: string | null;  // ← agregar
}
```

Usar exactamente los mismos nombres y tipos que `XResponse` del backend.

---

## Paso 5: Actualizar el service frontend (si el campo es enviable)

Si el nuevo campo se puede crear/editar desde el frontend, actualizar el payload en `src/services/widgets-api.ts`:

```ts
export async function createBackendWidget(user: User, data: Omit<Widget, 'id'>): Promise<Widget> {
  // El body ya incluye notes si está en el tipo Widget — no hay cambio adicional
  body: JSON.stringify(data),
```

Si el campo es solo de lectura (calculado en backend), no hay cambio en el service frontend.

---

## Paso 6: Actualizar el schema de validación del backend (si aplica)

En `routes.ts`, el schema Zod del endpoint también debe incluir el campo:

```ts
const widgetCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).optional().nullable(),  // ← agregar
});
```

---

## Casos especiales

### Campo que rompe filas existentes (NOT NULL sin default)

Nunca agregar un campo `NOT NULL` sin default si ya hay datos en producción. Opciones:
- Hacerlo opcional: `String?`
- Darle un default: `String @default("")`
- Hacer una migración en dos pasos: primero agregar nullable, luego rellenar, luego hacer NOT NULL

### Renombrar un campo

`prisma db push` no renombra — elimina el campo viejo y crea uno nuevo (pérdida de datos). Para renombrar de forma segura en producción:
1. Agregar el campo nuevo
2. Rellenar los datos (script o migración)
3. Eliminar el campo viejo

### Eliminar un campo

Primero asegurarse de que ningún código lo referencia. Buscar el nombre del campo en todo el proyecto antes de eliminarlo del schema.

---

## Verificación

```bash
# 1. Verificar que prisma db push pasó sin errores
cd backend && npx prisma db push

# 2. Verificar que el TypeScript compila
/test
```

---

## Lo que NO hacer

- No usar `prisma migrate dev` para cambios en Railway — el proyecto usa `db push`
- No olvidar actualizar `src/types.ts` cuando cambia `XResponse` en backend
- No agregar campos `NOT NULL` sin default a tablas con datos existentes
- No olvidar la relación inversa en `Store` cuando se agrega un modelo nuevo
- No hacer `npx prisma generate` manualmente — `db push` lo hace automáticamente
