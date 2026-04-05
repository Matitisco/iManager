## Context

Editar cualquier campo de un producto requería abrir el panel lateral `InventoryEditPanel`. Para correcciones rápidas (un precio mal escrito, una capacidad) esto era innecesariamente disruptivo. Se implementó edición inline directamente en la celda de la tabla.

## Goals / Non-Goals

**Goals:**
- Doble click en celda → input inline sobre la celda (mismo tamaño visual)
- Enter o blur → guarda via PATCH; Escape → cancela
- Optimistic update inmediato; revert si el API falla
- Ref-based display override: mientras el API responde, se muestra el nuevo valor aunque el estado de React aún no se actualizó
- Input se cierra DESPUÉS de que el API retorna (no antes)
- 30 chars máximo en celdas de texto y nombres de columna

**Non-Goals:**
- No todos los campos son editables inline (solo strings y números simples)
- Sin undo después de persistir
- Sin multi-cell edit (un campo a la vez)

## Decisions

**1. Ref-based display override**
El ciclo React (optimistic update → re-render) introduce un frame de flash donde se muestra el valor anterior. Se usa un `ref` para forzar el valor en el DOM sin esperar el ciclo de render, eliminando el flash completamente.

**2. Input cerrado después del API**
Cerrar el input antes de que el API retorne puede causar que `onBlur` dispare un segundo save. Se espera la respuesta antes de limpiar `editingCell`.

**3. `escapedRef` para cancel de category rename**
El rename de categorías usaba `onBlur` para guardar. Escape ahora setea `escapedRef.current = true` antes de llamar `blur()`, y el handler de blur chequea ese ref para no guardar.

## Risks / Trade-offs

- **Race conditions con edición rápida**: si el usuario edita una celda, la guarda y edita otra antes de que el primer PATCH retorne, puede haber conflictos de estado. Mitigación: deshabilitar el input mientras hay un PATCH en vuelo (pendingCell overlay).
- **Límite de 30 chars**: arbitrario pero suficiente para nombres de productos reales; previene overflow visual.
