## Context

La tabla tenía columnas de ancho y orden fijo, lo que no se adaptaba a distintos flujos de trabajo. Además, las acciones sobre items solo estaban disponibles en el panel lateral o en la barra de bulk actions, requiriendo múltiples clicks para operaciones simples. Se añadió personalización completa de columnas y un menú contextual.

## Goals / Non-Goals

**Goals:**
- Resize: drag handle en el borde derecho de cada header; `MIN_COL_WIDTH` como límite inferior
- Reorder: drag del header; floating pill sigue el cursor, cursor oculto, indicador vertical de drop position
- Rename: doble click en header → input inline; límite 30 chars
- Headers planos (sin gradiente); indicador de celda en edición = borde redondeado
- Menú contextual (right-click) en filas: acciones individuales + bulk si hay selección
- Escape → deseleccionar todos los rows
- Battery indicator rojo para < 70%
- Cursor management en `useEffect` para evitar cursor invisible pegado

**Non-Goals:**
- Sin persistencia del layout en backend (se usa localStorage)
- No se pueden mostrar/ocultar columnas del sistema (solo custom)
- El menú contextual no soporta teclado

## Decisions

**1. Pointer events para column drag**
Mismo patrón que category tabs DnD: `pointerdown/pointermove/pointerup` en lugar de HTML5 drag API para control total del cursor y del ghost element.

**2. Floating pill para column drag**
En lugar de mover la columna en tiempo real (costoso), se muestra un "pill" flotante con el nombre de la columna que sigue el cursor, y un indicador vertical de posición de drop. El movimiento real ocurre al soltar.

**3. `useEffect` para cursor management**
Manejar el cursor en event handlers causaba que el estilo quedara aplicado si el componente se desmontaba durante el drag. Moverlo a `useEffect` con cleanup garantiza que el cursor se restaura.

**4. Menú contextual con `mousedown` para cerrar**
El menú se cerraba en `mousedown` del document, lo que causaba que los botones del menú no se dispararan (se cerraba antes del `click`). Se corrigió usando `mouseup` para cerrar, o comprobando que el click fue fuera del menú.

## Risks / Trade-offs

- **localStorage para layout**: si el usuario limpia localStorage, el layout se resetea. Aceptable por ahora.
- **Resize con `table-fixed`**: se forzó `table-layout: fixed` para que los anchos sean respetados. Esto requiere que la suma de anchos de columnas sea gestionada manualmente para evitar overflow.
