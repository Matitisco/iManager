## Context

La tabla de inventario renderiza filas con `<tr key={invItem.id}>` dentro de un `<tbody>`. El proyecto ya usa `motion/react` v12 (`motion.div`, `AnimatePresence`, `Variants`) en el mismo archivo. Los moves de categoría se ejecutan todos via `bulkMoveCategory(ids, catId)` en AppContext, que actualiza el array `inventory` de forma optimista. Al cambiar `activeCategoryId`, `filteredInventory` recomputa instantáneamente y los ítems desaparecen/aparecen sin transición.

## Goals / Non-Goals

**Goals:**
- Exit animation: ítems animan antes de desaparecer del DOM (salida de categoría actual)
- Enter animation: ítems animan al aparecer en la nueva categoría (cambio de tab o move completado)
- Rápido: duración total ≤ 150 ms; no introduce delay perceptible en la operación
- Sin cambios en AppContext, backend ni flujo de datos

**Non-Goals:**
- Animaciones en delete, sort, paginación o import
- Drag-and-drop visual entre categorías
- Animaciones en el tab "Todos"

## Decisions

### Decision: `AnimatePresence` + `motion.tr` en tbody

`AnimatePresence mode="popLayout"` envuelve el `.map()` de filas en `<tbody>`. Las filas `<tr>` se convierten a `motion.tr` con props de animación.

**Por qué:** Es la forma nativa de `motion/react` para animar entradas y salidas de lista. No requiere estado extra ni `setTimeout`. `AnimatePresence` se encarga de mantener el elemento en el DOM durante el exit animation antes de removerlo, aunque `filteredInventory` ya no lo incluya.

**Alternativa descartada — state `exitingIds` + delay:**
Guardar IDs en un set, hacer `setTimeout(120ms)` y llamar `bulkMoveCategory` después. Descartada porque introduce latencia real en la operación de negocio (el PATCH al backend se retrasa) y requiere reconciliar el estado si el usuario hace otra acción durante el delay.

**Alternativa descartada — CSS transitions puras:**
No puede animar salidas en React (el elemento ya no existe en el DOM cuando se aplica la clase).

### Decision: Sin stagger en exit; stagger mínimo en enter

Exit: `duration: 0.1` sin delay — todas las filas salen simultaneamente. El stagger en exits de lista resulta lento.

Enter: `delay: index * 0.015` con `duration: 0.1` — stagger de 15 ms por fila. Con PAGE_SIZE = 20, la última fila tarda 0.1 + 0.285 = 385 ms en completar, pero la **percepción** de la tabla como "cargada" ocurre cuando la primera fila aparece (~100 ms). Valores más altos hacen la UI sentirse lenta.

### Decision: Animaciones solo cuando `activeCategoryId !== 'all'`

En el tab "Todos" los ítems nunca desaparecen al moverse (el tab muestra todo), así que el exit animation no aplica. El enter animation puede aplicar universalmente pero el beneficio en "Todos" es menor dado el volumen de ítems.

### Decision: `initial={false}` en `AnimatePresence` wrapper del container padre

El `motion.div` raíz con `variants={container}` ya tiene `initial="hidden" animate="show"`. Al cambiar de categoría, se necesita que las nuevas filas tengan `initial={{ opacity: 0 }}` para animar la entrada. Sin `initial={false}` en el `AnimatePresence` del tbody, las filas también animarían en el primer render (correcto). No se necesita suprimir esto.

## Risks / Trade-offs

- **`motion.tr` y altura de tabla**: `mode="popLayout"` puede causar un resize brusco del tbody si muchas filas salen al mismo tiempo (bulk move grande). Mitigación: la duración corta (100ms) hace que el resize sea imperceptible.
- **Inline-edit activo durante move**: Si el usuario tiene un input inline activo en una fila que se mueve, la fila animará y desaparecerá. No es un problema — el move descarta el edit implícitamente (la fila deja de ser visible).
- **Performance con PAGE_SIZE=20**: 20 instancias de `motion.tr` son triviales para motion/react. Sin overhead apreciable.
