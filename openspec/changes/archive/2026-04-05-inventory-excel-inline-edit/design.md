## Context

La tabla de inventario ya tiene edición inline básica: doble-click activa un input sobre la celda, Enter/click-fuera guarda, Escape cancela. Sin embargo, hacer click simple en una fila abre el modal de edición completo (InventoryEditPanel), lo que interrumpe el flujo cuando el usuario quiere editar varias celdas seguidas.

Este diseño extiende el sistema de edición inline existente para soportar navegación por teclado entre celdas y restringe el modal completo al menú contextual.

## Goals / Non-Goals

**Goals:**
- Navegación Tab/Shift+Tab entre celdas de la misma fila
- Enter confirma y baja a la misma columna en la fila siguiente
- Flechas ↑↓ navegan entre filas (misma columna) al confirmar; ←→ se comportan normalmente dentro del input nativo
- Escape cancela sin guardar
- Click simple en fila ya no abre el modal
- Hitbox de celda ajustada al contenido (sin padding sobrante)
- Modal de edición completa accesible solo desde "Editar" en menú contextual

**Non-Goals:**
- Validación de tipo por celda (precio solo números, etc.)
- Deshacer (Ctrl+Z) post-guardado
- Edición multi-celda / selección de rango
- Cambios en el backend

## Decisions

### 1. Estado de celda activa: extender `editingCell` existente

**Decisión:** Mantener el estado `editingCell: { id, field } | null` existente y agregar `focusedCell: { rowIndex, colKey } | null` para navegación sin edición (celda "seleccionada" pero sin input activo).

**Alternativa descartada:** Un estado unificado `activeCell` con modo `'editing' | 'selected'`. Aumenta la superficie de lógica de estado sin beneficio claro dado que la edición ya funciona.

**Rationale:** Dos estados ortogonales (editando vs. enfocado) son más simples de razonar. `editingCell` ya está integrado con el PATCH al backend; `focusedCell` es puramente UI.

---

### 2. Navegación Tab: columnas en orden de renderizado

**Decisión:** Tab avanza al siguiente `colKey` visible en el orden en que aparecen las columnas renderizadas (respetando columnas ocultadas/reordenadas). Al llegar a la última columna de una fila, avanza a la primera columna de la fila siguiente. Al final de la última fila, no hace nada.

**Rationale:** El array de columnas visibles ya existe como estado derivado (`visibleCols`). Recorrerlo en orden es la fuente de verdad natural.

---

### 3. Enter: confirma y baja (misma columna)

**Decisión:** Enter confirma la celda activa y activa `editingCell` en la misma columna de la fila siguiente (si existe). Esto imita el comportamiento de Excel en edición vertical.

**Alternativa descartada:** Enter solo confirma y no mueve el foco. Demasiado pasivo para edición de lotes.

---

### 4. Escape: cancela, celda permanece enfocada

**Decisión:** Escape cancela la edición (restaura valor anterior) y mantiene `focusedCell` en la celda actual sin cerrarla del todo, para que el usuario pueda volver a editarla con doble-click o simplemente navegar.

---

### 5. Eliminar onClick en `<tr>` para abrir modal

**Decisión:** Remover el handler `onClick` del `<tr>` que actualmente abre `InventoryEditPanel`. El modal permanece montado y funcional; solo se elimina su punto de entrada desde el click de fila.

**El único punto de entrada al modal pasa a ser** la opción "Editar" del menú contextual (click derecho), que ya existe.

**Riesgo:** Usuarios acostumbrados al click en fila perderán esa vía. Se mitiga con la edición inline más fluida como reemplazo directo.

---

### 6. Hitbox de celda: `w-full h-full` sin padding extra

**Decisión:** El input inline y el área clickeable para doble-click deben ocupar exactamente el espacio de la celda (`w-full h-full`) sin padding adicional en el wrapper. El padding visual de la celda (`<td>`) se mantiene para el layout general, pero el área de doble-click listener no agrega espacio extra sobre el contenido de texto.

**Rationale:** El padding actual en el div interno crea zonas muertas donde el doble-click no activa la edición aunque visualmente parezca que debería.

## Risks / Trade-offs

- **[Pérdida de affordance del modal]** → Usuarios que usaban el click en fila para editar campos complejos (dropdowns, etc.) necesitan aprender el menú contextual. Mitigación: el menú contextual ya está en producción y documentado.
- **[Conflicto Tab con navegación del navegador]** → `preventDefault()` en el handler de Tab dentro del input puede sorprender en algunos contextos de accesibilidad. Mitigación: solo prevenir default cuando hay una `editingCell` activa.
- **[Orden de columnas dinámico]** → Si el usuario reordena columnas mientras edita, el índice de `focusedCell` puede quedar desfasado. Mitigación: usar `colKey` (string) como identificador, no índice numérico.
