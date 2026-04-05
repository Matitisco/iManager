## Why

El flujo actual abre un modal de edición al hacer click en una fila, lo que interrumpe el flujo de trabajo al editar múltiples ítems seguidos. Para usuarios que actualizan precios, stock o condiciones en lote, una experiencia Excel-like (navegar con Tab/flechas, editar in-place) reduce drásticamente el tiempo por operación.

## What Changes

- **Eliminar apertura de modal por click simple en fila**: hacer click en una fila ya no abre el panel de edición. El modal de edición (InventoryEditPanel) queda reservado exclusivamente para la acción "Editar" del menú contextual (click derecho).
- **Extender edición inline a todas las celdas**: cualquier celda editable soporta doble-click para entrar en modo edición in-place.
- **Navegación teclado entre celdas**: Tab y Shift+Tab avanzan/retroceden entre celdas de la misma fila; Enter confirma y baja a la misma columna en la fila siguiente; las teclas de flecha (↑ ↓ ← →) navegan entre celdas sin editar.
- **Escape cancela sin guardar**: comportamiento existente se mantiene.
- **Hitbox ajustada**: el área clickeable de cada celda se ajusta al contenido — sin padding sobrante que crea zonas muertas.
- **Persistencia inmediata**: cada confirmación de celda dispara un PATCH al backend sin necesidad de guardar explícitamente.

## Capabilities

### New Capabilities
- `inventory-keyboard-cell-navigation`: Navegación entre celdas con Tab, Shift+Tab, Enter y flechas durante y fuera de edición inline.

### Modified Capabilities
- `inventory-inline-edit`: Extensión del comportamiento existente para cubrir navegación por teclado, hitbox ajustada, y restricción del modal al menú contextual únicamente.

## Impact

- **`src/pages/Inventory.tsx`**: eliminar handler de click en fila que abre modal; agregar lógica de navegación por teclado (Tab, Enter, flechas) al gestor de edición inline.
- **`src/components/InventoryEditPanel.tsx`** (o modal equivalente): sin cambios funcionales — sigue siendo el panel completo, ahora solo accesible vía menú contextual.
- **`src/context/AppContext.tsx`**: sin cambios — `updateProduct` ya expone el PATCH necesario.
- **`backend/`**: sin cambios — el endpoint PATCH inventory ya existe y es suficiente.
- **No hay cambio de schema Prisma.**

### Non-goals
- Validación de tipo por celda (ej: solo números en precio) — queda para una iteración posterior.
- Deshacer (Ctrl+Z) post-guardado.
- Edición multi-celda simultánea (como selección de rango en Excel).
- Cambios en la vista móvil / responsiva.
