## Why

Editar un producto requería abrir un panel lateral con todos los campos, lo que interrumpía el flujo cuando solo se quería corregir un precio o un nombre. Se implementó edición inline por celda para cambios rápidos directamente en la tabla.

## What Changes

- **Doble click en celda**: activa input inline sobre la celda; Enter/blur guarda, Escape cancela
- **Indicador visual**: borde redondeado en la celda activa durante la edición
- **Optimistic update**: el valor se muestra inmediatamente; se revierte si el API falla
- **Ref-based display override**: elimina el flash visual entre el valor anterior y el nuevo mientras el API responde
- **Input cerrado después del API**: no antes, para evitar race conditions
- **Límite de 30 caracteres** en inputs de nombre de celda y nombre de columna
- **Escape en rename de categoría**: cancela sin disparar `onBlur` save

## Capabilities

### Modified Capabilities

- `inventory-table`: Edición inline por celda con doble click

## Impact

- **src/pages/Inventory.tsx**: estado `editingCell`, handlers de doble click, optimistic update, ref overlay
- **src/services/inventory-api.ts**: `updateProduct` con PATCH; `renameCategoryApi`
- **backend/src/modules/inventory/**: endpoint `PATCH /api/inventory/:id` ya existente

## Non-goals

- No todos los campos son editables inline (solo texto/número simples; campos como `sold` o `categoryId` requieren el panel)
- No hay undo después de guardar
