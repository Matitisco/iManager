---
description: Hardening de write path en AppContext — eliminar fallbacks silenciosos a Firestore en módulos ya migrados a Postgres (Sales, Clients, TradeIns).
---

# Harden — Eliminar fallbacks silenciosos a Firestore

Aplicar cuando se pida hardener un módulo o eliminar el fallback a Firestore de un módulo ya migrado.

**Contexto:** Inventory y Trade-ins ya están hardenados. Sales y Clients todavía tienen fallback silencioso al write path. El `onSnapshot` de tradeIns en la línea ~179 es redundante.

---

## Qué significa "hardenado"

Un módulo **hardenado** cumple tres condiciones:

1. **Read path**: si el backend falla al cargar datos, no cae silenciosamente a Firestore — lanza error visible
2. **Write path**: si una operación falla, no reintenta en Firestore silenciosamente — re-lanza el error
3. **Sin onSnapshot activo**: no hay subscripción a Firestore corriendo en paralelo para ese módulo

---

## El patrón a eliminar (unhardened)

Este es el patrón actual de Sales y Clients en AppContext:

```ts
// ❌ UNHARDENED — fallback silencioso
const addFoo = async (data) => {
  const canUseBackend = fooSource === 'backend' && backendFooEnabled;
  try {
    if (canUseBackend) {
      const result = await createBackendFoo(user, data);
      setFoos(prev => [result, ...prev]);
      return;
    }
    // Firestore fallback (modo sin backend)
    const id = generateId('F');
    await setDoc(doc(db, 'foos', id), data);
    setFoos(prev => [{ id, ...data }, ...prev]);
  } catch (error) {
    if (canUseBackend) {
      console.warn('Backend failed, falling back to Firestore.', error);
      setFooSource('firestore');           // ← esto es el problema
      // ... re-intenta en Firestore ...
      return;
    }
    handleFirestoreError(error, ...);
  }
};
```

---

## El patrón correcto (hardened)

Tomado de `addProduct` / `updateProduct` / `deleteProduct` (Inventory, ya hardenado):

```ts
// ✅ HARDENED — sin fallback silencioso
const addFoo = async (data) => {
  if (!user) return;
  const backendConfigured = backendStatus !== 'unconfigured';
  try {
    if (backendConfigured) {
      if (!backendFooEnabled) {
        throw new Error(
          backendMessage || 'El backend todavía no está listo. Reintentá en unos segundos.'
        );
      }
      const result = await createBackendFoo(user, data);
      setFoos(prev => [result, ...prev]);
      return;
    }
    // Solo llega acá si backendStatus === 'unconfigured' (modo sin backend)
    const id = generateId('F');
    await setDoc(doc(db, 'foos', id), data);
    setFoos(prev => [{ id, ...data }, ...prev]);
  } catch (error) {
    if (backendConfigured) {
      throw error; // ← re-lanza, no silencia
    }
    handleFirestoreError(error, OperationType.CREATE, `foos/${...}`);
  }
};
```

**Diferencias clave:**
- `backendConfigured = backendStatus !== 'unconfigured'` en lugar de `canUseBackend = source === 'backend' && backendEnabled`
- En el `catch`: `throw error` en lugar de `setSalesSource('firestore')` + retry Firestore
- El `backendEnabled` check está en el `try`, no como condición del fallback

---

## Read path: el patrón correcto

El `useEffect` que carga datos al iniciar también debe hardenearse:

```ts
// ❌ UNHARDENED
const loadBackendFoos = async () => {
  try {
    const data = await fetchBackendFoos(user);
    setFoos(data);
    setFooSource('backend');
  } catch (error) {
    console.warn('Backend unavailable, falling back to Firestore.', error);
    startFirestoreFallback(); // ← eliminar esta rama
  }
};
```

```ts
// ✅ HARDENED
const loadBackendFoos = async () => {
  try {
    const data = await fetchBackendFoos(user);
    setFoos(data);
    setFooSource('backend');
  } catch (error) {
    if (cancelled) return;
    // No hay fallback — el error de backend se refleja en backendStatus
    // El usuario verá el banner de backend offline
  }
};
```

---

## El bug del doble onSnapshot de tradeIns

En AppContext, línea ~179, hay un `onSnapshot` a `tradeIns` en Firestore que corre **siempre** al autenticarse, incluso cuando el backend está activo:

```ts
// En el useEffect de sesión (el que llama loadBackendSession):
const unsubTradeIns = onSnapshot(collection(db, 'tradeIns'), (snapshot) => {
  setTradeIns(snapshot.docs.map(...));
}, (error) => handleFirestoreError(...));
```

Este listener **sobreescribe** los datos que ya cargó el backend. Debe eliminarse. Trade-ins tiene su propio `useEffect` con `backendTradeInsEnabled` más abajo.

---

## Pasos para hardener un módulo

1. **Read path** (`useEffect` de carga): eliminar la rama `catch → startFirestoreFallback()`
2. **Write path** (addX, updateX, deleteX): reemplazar el patrón `canUseBackend` + catch-fallback por el patrón `backendConfigured` + `throw error`
3. **Eliminar onSnapshot redundante** si existe (como el de tradeIns)
4. Correr `/test` después

---

## Lo que NO hacer

- No eliminar el path de Firestore en el happy path — tiene que seguir funcionando si `backendStatus === 'unconfigured'`
- No cambiar la lógica de `backendXEnabled` — solo cambiar el comportamiento en el catch
- No hardener Inventory ni Trade-ins — ya están hechos
- No crear un nuevo contexto para el módulo hardenado
