## Why

Al mover ítems entre categorías (individual o bulk), la fila desaparece abruptamente sin feedback visual — el usuario no tiene confirmación inmediata de que la acción ocurrió. Agregar animaciones de salida y entrada hace la interacción más legible y alineada con el estilo visual de iManager.

## What Changes

- Los ítems animan al **salir** de la categoría actual tras un move (exit animation antes de ser removidos del DOM)
- Los ítems animan al **entrar** en la nueva categoría cuando el usuario navega a ella (enter animation al montar las filas)
- Las animaciones son **cortas e instantáneas** (≤150 ms) — funcionales, no decorativas
- Funciona para moves **individuales** y **bulk**
- Sin cambios en la lógica de persistencia ni en el backend

## Capabilities

### New Capabilities

_(ninguna — esta feature extiende comportamiento existente)_

### Modified Capabilities

- `inventory-categories`: El requisito "Mover productos entre categorías" cambia — ahora incluye feedback visual animado al salir de la categoría y al entrar en la nueva.

## Impact

- **Módulo afectado**: Inventory (frontend únicamente)
- **Archivos probables**: `src/pages/Inventory.tsx`, `src/components/InventoryTable.tsx` (o equivalente donde se renderiza la tabla)
- **Sin cambios de schema Prisma**
- **Sin cambios de API**

## Non-goals

- No se agregan animaciones a otras acciones (delete, sort, paginación)
- No se implementa drag-and-drop visual entre categorías
- No se cambia el timing de la llamada al backend (optimistic update sigue igual)
