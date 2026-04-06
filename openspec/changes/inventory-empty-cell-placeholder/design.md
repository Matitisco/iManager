## Context

La tabla de inventario renderiza las 5 columnas fijas (imei, model, battery, price, status) en `renderTd` dentro de `Inventory.tsx`. Actualmente no hay guard para valores vacíos: si `invItem.imei` es `null` o `""`, la celda se muestra en blanco. La función `cellDisplay` gestiona el optimistic update pero no es responsable del formato visual.

Custom columns no se renderizan en la tabla hoy (solo en el panel lateral), por lo que están fuera del alcance de este change.

## Goals / Non-Goals

**Goals:**
- Celdas con valor `null`, `undefined` o `""` muestran `---` en modo display.
- Al activar inline edit sobre una celda con `---`, el input aparece vacío (no `---`).
- Battery vacía: omitir la barra de progreso, mostrar solo `---`.
- Price vacío (`null`/`undefined`): mostrar `---` en lugar de `$0`.
- Status vacío: mostrar `---` en texto plano, sin badge.

**Non-Goals:**
- No tocar `cellDisplay` ni la lógica de optimistic update.
- No aplicar a custom columns (no están en la tabla).
- No personalizar el placeholder por columna.
- No cambios de backend ni schema.

## Decisions

### Helper `displayVal` inline en Inventory.tsx

Crear una función de un línea dentro del componente, solo para el render de display:

```ts
const displayVal = (v: any): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);
```

Devuelve `null` cuando vacío, lo que permite branching limpio en cada case:

```tsx
// ejemplo en case 'imei':
{displayVal(cellDisplay(...)) ?? <span className="text-gray-300">---</span>}
```

**Alternativa descartada — modificar `cellDisplay`:** Devolvería `'---'` como string real, lo que pasaría `'---'` como valor inicial al `startInlineEdit`, contaminando el edit con un placeholder string. Requeriría un guard adicional en el commit.

### Battery vacía: sin barra

Cuando `displayVal(batteryHealth)` es null, no renderizar el `<motion.div>` de progreso. Solo mostrar el texto `---` con el mismo wrapper de hover. Esto evita una barra en 0% que sería engañosa.

### Price vacío: `null`/`undefined` solamente

`price` es un número en PG. `0` es un precio válido. Solo tratar `null`/`undefined` como vacío, nunca `0`.

### Status vacío: texto plano sin badge

Si `statusVal` es vacío, mostrar `---` como texto plano con `text-gray-300`, sin intentar resolver `STATUS_META`. Evita el fallback actual a `EN_REVISION` meta para ítems sin status.

## Risks / Trade-offs

- **Riesgo: `$0` vs vacío en price** → Decidido: `0` es precio válido, se muestra `$0`. Solo `null`/`undefined` → `---`.
- **Riesgo: status sin badge visual** → Intencional. Un item sin status no debería mostrar un badge de "EN REVISIÓN" engañoso.

## Migration Plan

Solo cambios de frontend en `src/pages/Inventory.tsx`. No hay migración de datos ni cambio de API. Deploy directo via Railway al pushear.
