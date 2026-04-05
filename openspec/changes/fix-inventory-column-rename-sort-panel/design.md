## Context

El panel Ordenar en `Inventory.tsx` define sus opciones como un array literal inline con etiquetas hardcodeadas:
```tsx
[
  { key: 'model', label: 'Modelo' },
  { key: 'price', label: 'Precio' },
  { key: 'battery', label: 'Batería' },
  { key: 'condition', label: 'Condición' },
]
```

Los headers de la tabla leen el nombre de cada columna vía `colNames[col] || DEFAULT_COL_NAMES[col]`, donde `colNames` es estado local persistido en `localStorage('inventoryColNames')`. El sort panel nunca consulta este estado.

## Goals / Non-Goals

**Goals:**
- Sort panel muestra el mismo nombre que el header para columnas `model`, `price`, `battery`
- Sin duplicar estado ni lógica — una sola fuente de verdad (`colNames` + `DEFAULT_COL_NAMES`)

**Non-Goals:**
- No mover `colNames` a AppContext ni al backend
- No cambiar lógica de sort ni agregar nuevas opciones
- No afectar `condition` (no es una ColId visible en la tabla)

## Decisions

**Derivar labels dinámicamente desde `colNames`**

Las sort options se construyen usando `colNames[key] || DEFAULT_COL_NAMES[key]` para las keys que son ColIds (`model`, `price`, `battery`). `condition` queda con su label hardcodeado `'Condición'` porque no tiene columna asociada renombrable.

No hay alternativa razonable: duplicar el nombre en otro lugar requeriría sincronización manual, que es exactamente el bug actual.

## Risks / Trade-offs

- [Riesgo mínimo] Si el usuario borra `localStorage` manualmente, los nombres vuelven a los defaults — comportamiento correcto y esperado.
