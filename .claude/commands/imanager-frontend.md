---
description: Patrones y convenciones para cambios en src/ del frontend de iManager (React + TypeScript + Tailwind CSS 4)
---

# iManager Frontend Skill

Aplicar esta skill antes de escribir cualquier código en `src/`.

---

## Stack y versiones

- React 19 (no React 18 patterns — sin `forwardRef`, preferir hooks)
- TypeScript strict
- Tailwind CSS 4 (no v3 — la sintaxis de algunos utilities cambió)
- `motion/react` (no `framer-motion` — el import cambió)
- lucide-react para íconos
- recharts para gráficos

---

## Patrones de estado global

Todo el estado de negocio vive en `AppContext.tsx`. **No crear contextos paralelos** para datos que ya maneja AppContext.

```ts
// ✅ Correcto
const { inventory, addProduct, appSession } = useAppContext();

// ❌ Incorrecto — no hacer useState local para datos globales
const [items, setItems] = useState([]);
useEffect(() => fetchItems(), []);
```

### `appSession` — qué tiene y cómo usarlo

```ts
appSession?.store        // Store actual (id, name)
appSession?.membership   // StoreMember (role: 'OWNER' | 'ADMIN' | 'SELLER')
appSession?.user         // User interno de PG (displayName, email, avatarUrl)
appSession?.onboardingRequired // boolean
```

### `backendStatus` — estados posibles

| Estado | Significado |
|--------|-------------|
| `'checking'` | Resolución en curso (no mostrar error todavía) |
| `'ready'` | Backend OK, usar datos reales |
| `'offline'` | Backend no responde |
| `'unconfigured'` | Sin backend configurado (modo local) |

---

## Servicios HTTP

Toda llamada al backend va por los services en `src/services/`. **No usar fetch directo en componentes ni páginas.**

```ts
// ✅ Correcto
import { fetchBackendInventory } from '../services/inventory-api';
const items = await fetchBackendInventory(user);

// ❌ Incorrecto
const res = await fetch('/api/inventory');
```

Todos los services reciben `user: User` de Firebase Auth (para el token JWT):

```ts
// Patrón estándar de un service call
export async function fetchBackendInventory(user: User): Promise<Product[]> {
  const token = await user.getIdToken();
  return fetchWithTimeout(`${API_BASE}/inventory`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

---

## Convenciones de componentes

### Formularios / modales

- El submit debe esperar la resolución del async antes de cerrar el modal
- Mostrar error visible si la operación falla — **no cerrar como éxito si falló**
- Deshabilitar submit mientras `isLoading === true`

```tsx
const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await addProduct(data);
    onClose(); // solo si todo salió bien
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Error al guardar');
  } finally {
    setIsLoading(false);
  }
};
```

### Animaciones

Usar `motion/react` (no `framer-motion`):

```tsx
import { motion, AnimatePresence } from 'motion/react';
```

Patrones comunes del proyecto:
- Entradas: `initial={{ opacity: 0, y: 10 }}` → `animate={{ opacity: 1, y: 0 }}`
- Exit: `exit={{ opacity: 0, y: 10 }}`
- `AnimatePresence` en listas o condicionales

---

## Tipos importantes

```ts
// src/types.ts
Product    // item de inventario
Sale       // venta
TradeIn    // canje
Client     // cliente
CustomColumn
InventoryCategory

// src/types/app-session.ts
AppSession
BackendConnectionStatus
```

### `batteryHealth`

Es `string`, no número. Soporta valores como `"85%"`, `"83-85%"`, `"N/A"`. No asumir que es un número entero.

---

## Routing / navegación

La app no usa React Router. La navegación es por tabs gestionados en `App.tsx`:

```tsx
// Para navegar desde un componente interno
onNavigate?.('inventory');       // cambiar tab
onNavigate?.('settings', 'profile'); // tab + sub-tab
```

---

## Guards de seguridad

Antes de operar con datos de negocio, verificar que el backend esté listo:

```ts
const backendReady = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
```

---

## Lo que NO hacer

- No usar `any` como tipo — buscar el tipo correcto o crear uno
- No agregar Firestore imports para datos ya migrados a Postgres
- No hacer fetch directo en componentes (siempre por services)
- No cerrar modales antes de que el async resuelva
- No mezclar `framer-motion` con `motion/react`
- No usar `npm run build` (el build lo hace Railway en deploy)
