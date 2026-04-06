## Context

La tabla de inventario usaba un array `inventory[]` cargado completo en AppContext al iniciar sesión. La "paginación" era un `array.slice()` local — escalaba en memoria y tiempo de carga O(n) con la cantidad de equipos. Con 162 items ya se notaba; con miles sería inaceptable.

El IntersectionObserver previo usaba `root: tableContainerRef` que nunca scrolleaba (el scroll real está en `<main>` del Layout), por lo que solo disparaba una vez al montar y no volvía a cargar.

## Goals / Non-Goals

**Goals:**
- Cada fetch al server trae exactamente 30 ítems (`LIMIT 30 OFFSET skip`)
- Todos los filtros (condición, estado, capacidad, modelo, grado, batería, categoría) y el orden se resuelven en PostgreSQL
- "Seleccionar todo" selecciona los ítems del server (no solo los cargados en memoria)
- Backward-compatible: `GET /api/inventory` sin params sigue devolviendo `{ inventory }` para AppContext

**Non-Goals:**
- No se mueve la carga inicial de AppContext a lazy — otros módulos siguen usando `inventory[]`
- No se implementa cursor-based pagination (offset es suficiente para este volumen)
- No se agrega full-text search

## Decisions

### 1. `$queryRaw` de Prisma para la query paginada

**Decisión:** usar `prisma.$queryRaw` con `Prisma.sql` y `Prisma.join` en lugar del ORM.

**Por qué:** el filtro de batería requiere extraer el primer número de un string (`"83-85%"` → `83`) con una expresión PostgreSQL. Prisma ORM no soporta funciones SQL en `WHERE`. La alternativa de filtrar en JS después del fetch rompe la paginación (se traerían más de 30 para compensar los descartados).

**Alternativa descartada:** columna computed `batteryMin INT` en el schema. Requeriría migración de schema + backfill; `$queryRaw` lo resuelve sin tocar la DB.

### 2. Endpoint único con detección por params (backward-compat)

**Decisión:** `GET /api/inventory?skip=0&take=30` devuelve `{ items, total }`; sin `skip`/`take` devuelve `{ inventory }` (legacy).

**Por qué:** AppContext llama `fetchBackendInventory` que no pasa params. Cambiar la firma rompería la carga de otros módulos. Con detección por params se evita versionar el endpoint.

### 3. Estado local `items[]` + `total` en Inventory.tsx

**Decisión:** Inventory.tsx maneja su propio estado paginado, independiente de `inventory[]` de AppContext.

**Por qué:** AppContext es el estado global compartido — no corresponde hacerlo paginado ya que otros módulos (Sales) necesitan el array completo. La página de Inventory es la única que necesita paginación de display.

**Trade-off:** las mutaciones (update/delete/add) deben actualizar tanto AppContext como el estado local de la página. Se resuelve llamando el método de AppContext (que actualiza `inventory[]`) y luego actualizando `items[]` localmente.

### 4. IntersectionObserver con `root: null` (viewport)

**Decisión:** el observer usa el viewport como root, no el contenedor de la tabla.

**Por qué:** el scroll real ocurre en `<main className="overflow-y-auto">` del Layout, no en el `<div overflow-x-auto>` de la tabla. Con `root: tableContainerRef` el observer solo disparaba una vez al mount (el sentinel siempre estaba dentro del contenedor que no scrolleaba). Con `root: null` detecta cuando el sentinel entra al viewport.

### 5. Select-all vía endpoint `/ids`

**Decisión:** `GET /api/inventory/ids?filters...` devuelve solo los IDs de los ítems que matchean los filtros actuales.

**Por qué:** con paginación, `selectedIds` solo puede tener los IDs de los ítems cargados. Para seleccionar todos (ej. 162 ítems) se necesita una query liviana que devuelva solo strings — no los registros completos.

## Risks / Trade-offs

- **Desync entre AppContext y estado local:** Si AppContext actualiza `inventory[]` por otra vía (ej. recarga de Sales), `items[]` en Inventory.tsx no se refleja automáticamente → Mitigación: las mutaciones críticas actualizan ambos; la recarga completa se dispara al cambiar filtros.
- **Offset pagination drift:** si se agregan/eliminan ítems mientras el usuario scrollea, puede haber duplicados o gaps entre páginas → Mitigación: aceptado por simplicidad; cursor-based pagination lo resolvería pero agrega complejidad.
- **AppContext sigue cargando todo:** el ganancia en la página de Inventory no se traslada al tiempo de inicio de la app si hay miles de ítems → Mitigación: pendiente para una segunda iteración (mover AppContext a lazy load).

## Migration Plan

Sin migración de schema. El deploy a Railway aplica automáticamente. El endpoint es backward-compatible, por lo que no hay riesgo de downtime entre frontend y backend desincronizados.
