---
description: Receta end-to-end para agregar una feature nueva al stack completo de iManager — backend (Fastify+Prisma) → service frontend → AppContext → página.
---

# New Feature — Receta full-stack

Usar cuando se agrega una feature que requiere cambios en backend Y frontend.
Leer también `/imanager-backend` e `/imanager-frontend` para los patrones de cada capa.

---

## Checklist de pasos

Los pasos tienen orden. No saltear ninguno.

```
[ ] 1. Schema Prisma (si hay modelo nuevo)
[ ] 2. Backend: módulo (routes + service)
[ ] 3. Backend: registrar en app.ts
[ ] 4. Frontend: tipo en src/types.ts
[ ] 5. Frontend: service en src/services/
[ ] 6. Frontend: agregar a AppContext
[ ] 7. Frontend: página o componente
[ ] 8. Frontend: agregar a Sidebar (si es una sección nueva)
[ ] 9. /test
```

---

## Paso 1: Schema Prisma (si el feature necesita un modelo nuevo)

Editar `backend/prisma/schema.prisma`. Ver skill `/schema-change` para el proceso completo.

Si el feature solo usa modelos existentes, saltear este paso.

---

## Paso 2: Backend — módulo

Crear `backend/src/modules/[nombre]/` con tres archivos:

### `service.ts`

```ts
import { prisma } from "../../plugins/prisma.js";

export interface WidgetInput {
  name: string;
  // campos del modelo
}

export interface WidgetResponse {
  id: string;
  name: string;
  storeId: string;
}

// Serializador — convierte Prisma record a WidgetResponse
function serializeWidget(record: any): WidgetResponse {
  return {
    id: record.id,
    name: record.name,
    storeId: record.storeId,
  };
}

export async function listWidgets(storeId: string): Promise<WidgetResponse[]> {
  const items = await prisma.widget.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
  });
  return items.map(serializeWidget);
}

export async function createWidget(storeId: string, input: WidgetInput): Promise<WidgetResponse> {
  const item = await prisma.widget.create({
    data: { storeId, ...input },
  });
  return serializeWidget(item);
}

export async function updateWidget(storeId: string, id: string, input: Partial<WidgetInput>): Promise<WidgetResponse | null> {
  const existing = await prisma.widget.findFirst({ where: { id, storeId } });
  if (!existing) return null;
  const updated = await prisma.widget.update({ where: { id }, data: input });
  return serializeWidget(updated);
}

export async function deleteWidget(storeId: string, id: string): Promise<boolean> {
  const existing = await prisma.widget.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!existing) return false;
  await prisma.widget.delete({ where: { id } });
  return true;
}
```

**Reglas del service:**
- Siempre recibe `storeId` como primer parámetro
- Nunca toca `request` ni `reply`
- Siempre filtra por `storeId` — nunca queries sin el filtro de tienda

### `routes.ts`

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { listWidgets, createWidget, updateWidget, deleteWidget } from "./widget.service.js";

const widgetCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // campos del modelo
});

const widgetPatchSchema = widgetCreateSchema.partial();

export async function widgetRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const widgets = await listWidgets(request.appUser.storeId);
    return { widgets };
  });

  app.post("/", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const body = widgetCreateSchema.parse(request.body);
    const widget = await createWidget(request.appUser.storeId, body);
    return reply.code(201).send({ widget });
  });

  app.patch("/:id", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = widgetPatchSchema.parse(request.body);
    const widget = await updateWidget(request.appUser.storeId, id, body);
    if (!widget) return reply.code(404).send({ error: "Widget not found" });
    return { widget };
  });

  app.delete("/:id", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await deleteWidget(request.appUser.storeId, id);
    if (!deleted) return reply.code(404).send({ error: "Widget not found" });
    return reply.code(204).send();
  });
}
```

---

## Paso 3: Registrar en `backend/src/app.ts`

```ts
// 1. Agregar el import
import { widgetRoutes } from "./modules/widgets/widget.routes.js";

// 2. Registrar con prefix
app.register(widgetRoutes, { prefix: "/api/widgets" });
```

⚠️ **Este paso se olvida frecuentemente.** Sin él, las rutas no existen aunque el código esté.

---

## Paso 4: Tipo en `src/types.ts`

```ts
export interface Widget {
  id: string;
  name: string;
  // campos del modelo
}
```

Usar exactamente los mismos nombres de campo que devuelve el backend en `WidgetResponse`.

---

## Paso 5: Service frontend en `src/services/widgets-api.ts`

```ts
import type { User } from 'firebase/auth';
import type { Widget } from '../types';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendWidgetResponse = {
  widget?: Widget;
  widgets?: Widget[];
};

async function getAuthHeaders(user: User) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getBaseUrlOrThrow() {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) throw new Error('Backend no configurado');
  return baseUrl.replace(/\/+$/, '');
}

export async function fetchBackendWidgets(user: User): Promise<Widget[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/widgets`, {
    headers: await getAuthHeaders(user),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al cargar widgets (${response.status})`);
  }
  const data = await response.json() as BackendWidgetResponse;
  return data.widgets ?? [];
}

export async function createBackendWidget(user: User, data: Omit<Widget, 'id'>): Promise<Widget> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/widgets`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al crear widget (${response.status})`);
  }
  const result = await response.json() as BackendWidgetResponse;
  if (!result.widget) throw new Error('Respuesta inválida al crear widget');
  return result.widget;
}

export async function updateBackendWidget(user: User, widget: Widget): Promise<Widget> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/widgets/${widget.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(widget),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al actualizar widget (${response.status})`);
  }
  const result = await response.json() as BackendWidgetResponse;
  if (!result.widget) throw new Error('Respuesta inválida al actualizar widget');
  return result.widget;
}

export async function deleteBackendWidget(user: User, id: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/widgets/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al eliminar widget (${response.status})`);
  }
}
```

---

## Paso 6: Agregar a AppContext

Ver skill `/appcontext` — sección "Cómo agregar un nuevo módulo". En resumen:

1. `useState<Widget[]>([])` + `useState<DataSource>('firestore')`
2. `backendWidgetsEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired`
3. `useEffect` de carga que depende de `[backendWidgetsEnabled, user]`
4. CRUD functions hardened (sin fallback a Firestore)
5. Agregar al interface `AppState` y al `value` del Provider

---

## Paso 7: Página o componente

Si es una sección nueva, crear `src/pages/Widgets.tsx`:

```tsx
import React from 'react';
import { useAppContext } from '../context/AppContext';

export const Widgets: React.FC = () => {
  const { widgets, addWidget } = useAppContext();
  // ...
};
```

Si es funcionalidad dentro de una página existente, agregar al componente correspondiente.

---

## Paso 8: Agregar a Sidebar (si es sección nueva)

En `src/components/Sidebar.tsx`, agregar a `navItems`:

```ts
{ id: 'widgets', label: 'Widgets', icon: LayoutGrid },
```

En `src/App.tsx`, agregar el case de navegación y renderizado:

```tsx
// En el renderizado condicional de páginas:
{activeTab === 'widgets' && <Widgets />}
```

---

## Paso 9: Verificar

```bash
/test   # lint TS frontend + backend
```

---

## Errores frecuentes

| Error | Causa | Fix |
|-------|-------|-----|
| 404 en `/api/widgets` | Olvidaste registrar en `app.ts` | Agregar `app.register(widgetRoutes, { prefix: "/api/widgets" })` |
| Página no recibe datos | Olvidaste el `useEffect` en AppContext | Agregar el useEffect que depende de `backendWidgetsEnabled` |
| TypeScript error en AppContext | Olvidaste agregar al interface `AppState` | Agregar al interface y al `value` del Provider |
| `any` en service.ts | Falta el tipo de retorno de Prisma | Definir `WidgetRecord` con los campos exactos del modelo |
