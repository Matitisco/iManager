---
name: inventory-dblclick-detection
type: design
---

# Design: Mejoras a la detección de doble-click

## Enfoque técnico

### 1. Detección de columna por posición X

`handleRowClick` usa `e.detail >= 2` (en lugar de `onDoubleClick`) para detectar doble-click. Si el click no cae sobre un `td[data-col]`, itera las columnas visibles en orden y compara `e.clientX` contra el `getBoundingClientRect()` del `<th>` correspondiente (via `thRefs.current[col]`).

```ts
if (!col || !EDITABLE_COL_IDS.has(col)) {
  const clickX = e.clientX;
  for (const candidateCol of colOrder.filter(c => visibleColumns[c] !== false)) {
    if (!EDITABLE_COL_IDS.has(candidateCol)) continue;
    const th = thRefs.current[candidateCol];
    if (!th) continue;
    const rect = th.getBoundingClientRect();
    if (clickX >= rect.left && clickX <= rect.right) { col = candidateCol; break; }
  }
}
```

### 2. Debounce de single-click

Dos nuevos refs:
- `clickTimerRef`: handle del setTimeout activo
- `pendingClickRef`: parámetros del click pendiente `{ invItem, index, shiftKey }`

En single-click: se guarda en `pendingClickRef` y se lanza un timer de 250ms.
En double-click: se cancela el timer pendiente antes de procesar el edit.

La lógica de selección se extrae a `applySelection(invItem, index, shiftKey)` para poder llamarla tanto desde el timer como desde futuros usos directos.

## Decisiones

- **250ms** es el umbral estándar de double-click en browsers (usualmente 300-500ms, se eligió 250ms para que la selección igualmente sienta responsive).
- `e.detail >= 2` en `onClick` es más robusto que `onDoubleClick` porque React puede no disparar `onDoubleClick` si el DOM cambia entre los dos clicks.
- No se usa `onDoubleClick` en `<td>` individual — el handler está en `<tr>` para cubrir toda la fila.
