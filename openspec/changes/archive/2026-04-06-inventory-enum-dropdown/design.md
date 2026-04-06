## Context

La tabla de inventario tiene un mecanismo de edición inline bien establecido: single-click sobre un `<div>` con hitbox `hover:bg-gray-200/70` abre un `<input>` para texto/número, se guarda via `commitInlineEdit` (PATCH al backend), con actualización optimista y debounce de selección de fila. La columna `status` quedó fuera de este sistema — muestra solo un badge estático sin interacción. `CustomColumn` (columnas personalizadas) soporta tipos `'text'` y `'number'` pero no `'enum'`.

## Goals / Non-Goals

**Goals:**
- Integrar `status` al sistema de inline edit existente como celda de tipo enum
- Un `<select>` nativo reemplaza al `<input>` cuando la celda es de tipo enum
- Guardar al cambiar de opción (evento `onChange` en lugar de `Enter`/`blur`)
- Definir `ENUM_COL_OPTIONS` como registro central extensible para futuros ColIds enum
- Agregar `type: 'enum'` y `options?: string[]` a `CustomColumn`
- Custom columns de tipo enum usan el mismo `<select>` inline

**Non-Goals:**
- Agregar `condition` o `grade` como columnas fijas de la tabla (el registro queda listo)
- Validación de enum en el backend
- Cambiar el InventoryEditPanel
- Cambios de schema Prisma

## Decisions

### 1. `<select>` nativo en lugar de dropdown custom

**Decisión**: usar `<select>` HTML nativo estilizado con Tailwind.

**Alternativas consideradas**:
- Dropdown custom con `<div>` + `AnimatePresence`: animación bonita, pero complejidad significativa para cerrar con Escape/click fuera, y posicionamiento.
- `<select>` nativo: funciona out-of-the-box con teclado, Escape, blur. El estilo con Tailwind es suficiente para mantener consistencia visual.

**Rationale**: el patrón ya existe en el formulario de "Agregar ítem" (linea ~1390 de Inventory.tsx). Reutilizarlo mantiene coherencia y reduce código.

### 2. Guardar en `onChange`, no en blur/Enter

**Decisión**: al seleccionar una opción en el `<select>`, se llama `commitInlineEdit` directamente en `onChange`.

**Rationale**: para enums no hay valor intermedio — el usuario elige y confirma en el mismo gesto. No tiene sentido el flujo "editar → confirmar con Enter". Blur también cierra sin guardar si el valor no cambió (igual que texto).

### 3. `ENUM_COL_OPTIONS` como registro central

**Decisión**: definir un record `ENUM_COL_OPTIONS: Partial<Record<ColId, string[]>>` junto a las otras constantes de columna.

```ts
const ENUM_COL_OPTIONS: Partial<Record<ColId, string[]>> = {
  status: ['DISPONIBLE', 'VENDIDO', 'EN_REVISION'],
  // condition: ['NUEVO', 'USADO', 'PRE-OWNED'],  ← listo para agregar
  // grade: ['A+', 'A', 'B', 'C', 'N/A'],
};
```

**Rationale**: centraliza las opciones en un solo lugar, evita switch/if dispersos, y hace trivial agregar nuevos enums.

### 4. Colores del badge en el select

**Decisión**: cuando el `<select>` está activo, se muestra sin badge (select simple); el badge coloreado vuelve en modo display.

**Rationale**: aplicar colores al `<select>` requeriría `appearance-none` + overlay custom. El tradeoff no vale: el select se abre por un instante, el badge coloreado vuelve inmediatamente al guardar.

### 5. `startInlineEdit` reutilizado para enums

**Decisión**: usar el mismo `startInlineEdit(id, 'status', invItem.status)` que para texto. El `<select>` lee `inlineEditValue` y lo actualiza igual.

**Rationale**: `commitInlineEdit` ya funciona para cualquier campo string — no necesita cambios. El único cambio es el elemento renderizado (`<select>` vs `<input>`).

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| El `<select>` nativo tiene estilo diferente entre plataformas (especialmente móvil) | La tabla es desktop-first; el `appearance-none` + classes Tailwind es suficiente |
| `onChange` guarda inmediatamente — no hay "cancelar" | Consistente con la UX esperada de un enum; Escape cierra el select sin guardar vía el handler existente |
| `status: 'VENDIDO'` normalmente se setea por una venta real | El dropdown lo permite igualmente — decisión de producto, no técnica |
