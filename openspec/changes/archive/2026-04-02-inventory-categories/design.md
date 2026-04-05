## Context

Sin categorías, tiendas con múltiples marcas o tipos de dispositivos tenían todo mezclado. Se necesitaba un sistema de organización flexible que no impusiera una jerarquía rígida: tabs simples, drag para reordenar, y las operaciones CRUD típicas.

## Goals / Non-Goals

**Goals:**
- Categorías por store (no globales)
- CRUD de categorías: crear con nombre, renombrar inline, eliminar con confirmación
- Filtrado de tabla por categoría activa (tab)
- Mover items: individual (desde panel/menú) y bulk (desde selección masiva)
- DnD para reordenar tabs con pointer events (floating block, cursor oculto, drop indicator)
- Rename inline: doble click en tab → input; Escape cancela, Enter/blur guarda

**Non-Goals:**
- Sin subcategorías
- Sin categorías predefinidas
- Sin compartir categorías entre stores

## Decisions

**1. Pointer events para DnD de tabs**
La HTML5 Drag API no permite controlar el cursor durante el drag ni renderizar un ghost personalizado en todos los browsers en Windows. Se reescribió con `pointerdown/pointermove/pointerup` para control total: cursor oculto, bloque flotante custom, indicador de drop.

**2. `categoryId` en el producto**
Cada producto tiene una FK opcional a `InventoryCategory`. Mover un producto = actualizar ese campo via PATCH.

**3. Confirmación antes de eliminar categoría**
Los items de la categoría eliminada quedan sin categoría (no se eliminan). El modal lo aclara explícitamente para evitar confusión.

**4. Rename inline sin disparar save en Escape**
El `onBlur` normalmente guarda. Se usó una flag `escapedRef` para distinguir Escape de un blur normal y evitar guardar en ese caso.

## Risks / Trade-offs

- **Sincronía entre tabs y filtro activo**: al eliminar la categoría activa, se vuelve al tab "Todos". Comportamiento intencional.
- **Reorder de tabs**: el orden se persiste en el backend (`order` field en `InventoryCategory`). Un error de red deja el orden visual desfasado temporalmente. Mitigación: optimistic update + revert on error.
