---
description: Patrones para leer y modificar AppContext.tsx — el archivo más sensible del frontend. Estado global, flags de backend, CRUD, cómo agregar un nuevo módulo.
---

# AppContext — Guía para modificar el contexto global

Leer esta skill **antes de tocar `src/context/AppContext.tsx`**.

AppContext es el archivo más sensible del proyecto. Errores aquí afectan toda la app. Entender su arquitectura antes de modificar cualquier parte.

---

## Arquitectura general

```
AppContext.tsx
  ├── Estado por módulo: inventory, sales, tradeIns, clients, customColumns, inventoryCategories
  ├── Source flags: inventorySource, clientsSource, salesSource, tradeInsSource
  ├── Backend flags: backendInventoryEnabled, backendClientsEnabled, ...
  ├── Sesión: appSession, backendStatus, backendMessage, user (Firebase)
  ├── useEffect #1: onAuthStateChanged → loadBackendSession (retry cada 15s si no está ready)
  ├── useEffect #2: onSnapshot de customColumns (Firestore — siempre activo)
  │   ⚠️  También tiene un onSnapshot de tradeIns REDUNDANTE (bug conocido, ver PROJECT_STATUS.md)
  ├── useEffect #3: carga inventory (backend o Firestore según backendInventoryEnabled)
  ├── useEffect #4: carga clients
  ├── useEffect #5: carga sales
  ├── useEffect #6: carga trade-ins
  └── CRUD functions: addX, updateX, deleteX para cada módulo
```

---

## Flags de backend

```ts
// Todos los módulos usan exactamente la misma condición:
const backendInventoryEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
const backendClientsEnabled   = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
const backendSalesEnabled     = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
const backendTradeInsEnabled  = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
```

El nombre `backendXEnabled` es la única cosa que varía. Estos flags son los que disparan los `useEffect` de carga a través de su dependencia.

**backendStatus posibles valores:**
- `'checking'` — sesión en resolución, no mostrar error todavía
- `'ready'` — backend OK, datos reales disponibles
- `'offline'` — backend no responde
- `'unconfigured'` — sin backend configurado (modo solo Firestore)

---

## Source flags

```ts
type DataSource = 'firestore' | 'backend';

// Uno por módulo:
const [inventorySource, setInventorySource] = useState<DataSource>('firestore');
const [clientsSource, setClientsSource]     = useState<DataSource>('firestore');
const [salesSource, setSalesSource]         = useState<DataSource>('firestore');
const [tradeInsSource, setTradeInsSource]   = useState<DataSource>('firestore');
```

Arrancan en `'firestore'` y se actualizan a `'backend'` cuando la carga del backend tiene éxito. En módulos **hardenados** (Inventory) el write path usa `backendStatus !== 'unconfigured'` en lugar de `source === 'backend'`. En módulos **no hardenados** (Sales, Clients) todavía se chequea `source === 'backend'` en el write path (ver skill `/harden`).

---

## useEffect de sesión

```ts
useEffect(() => {
  return onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    if (!firebaseUser) {
      setBackendStatus('unconfigured');
      setAppSession(null);
      return;
    }
    void loadBackendSession(firebaseUser);
  });
}, []);
```

`loadBackendSession` llama a `/api/me` y:
- Si `status !== 'ready'` o `session?.onboardingRequired` → reintenta en 15s
- Si falla → pone `backendStatus = 'offline'` y reintenta en 15s

**No tocar este useEffect** salvo que el cambio sea específicamente en el flujo de sesión.

---

## Cómo agregar un nuevo módulo a AppContext

Seguir exactamente este orden:

### 1. Tipo en `src/types.ts`

```ts
export interface Widget {
  id: string;
  storeId: string;
  name: string;
  // ...
}
```

### 2. Estado y source flag

```ts
const [widgets, setWidgets] = useState<Widget[]>([]);
const [widgetsSource, setWidgetsSource] = useState<DataSource>('firestore');
```

### 3. Flag de backend (igual que los demás)

```ts
const backendWidgetsEnabled = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
```

### 4. useEffect de carga

```ts
useEffect(() => {
  if (!user) return;
  let cancelled = false;

  const loadBackendWidgets = async () => {
    try {
      const data = await fetchBackendWidgets(user);
      if (cancelled) return;
      setWidgets(data);
      setWidgetsSource('backend');
    } catch (error) {
      if (cancelled) return;
      // No hacer fallback a Firestore — módulos nuevos van directamente hardenados
    }
  };

  if (backendWidgetsEnabled) {
    void loadBackendWidgets();
  }
  // Si backendWidgetsEnabled es false, widgets queda vacío hasta que el backend esté listo

  return () => { cancelled = true; };
}, [backendWidgetsEnabled, user]);
```

### 5. CRUD functions (hardened desde el inicio)

```ts
const addWidget = async (data: Omit<Widget, 'id'>) => {
  if (!user) return;
  const backendConfigured = backendStatus !== 'unconfigured';
  try {
    if (backendConfigured) {
      if (!backendWidgetsEnabled) {
        throw new Error(backendMessage || 'El backend todavía no está listo. Reintentá en unos segundos.');
      }
      const created = await createBackendWidget(user, data);
      setWidgets(prev => [created, ...prev]);
      return;
    }
    // Modo sin backend (si aplica)
  } catch (error) {
    if (backendConfigured) throw error;
    // handleFirestoreError solo si hay modo sin backend
  }
};
```

### 6. Exponer en el interface y value

Agregar al interface `AppState`:
```ts
widgets: Widget[];
addWidget: (data: Omit<Widget, 'id'>) => Promise<void>;
updateWidget: (widget: Widget) => Promise<void>;
deleteWidget: (id: string) => Promise<void>;
```

Agregar al `value` del Provider:
```ts
<AppContext.Provider value={{
  // ... existentes
  widgets,
  addWidget,
  updateWidget,
  deleteWidget,
}}>
```

---

## Cómo se consumen los datos en componentes

```ts
// ✅ Correcto — siempre via hook
const { widgets, addWidget } = useAppContext();

// ❌ Incorrecto — no hacer fetch directo ni estado local para datos globales
const [widgets, setWidgets] = useState([]);
useEffect(() => fetch('/api/widgets').then(...), []);
```

---

## Lo que NO hacer

- No crear un contexto paralelo para un módulo nuevo
- No tocar el `useEffect` de sesión (el de `onAuthStateChanged`) para lógica de datos
- No cambiar `backendXEnabled` — siempre es la misma condición para todos los módulos
- No hacer `setXSource('firestore')` en el catch de módulos nuevos — ir directamente hardenado
- No importar datos de Firestore en módulos ya migrados a Postgres
- No agregar `onSnapshot` nuevos para módulos que ya tienen su `useEffect` de backend
