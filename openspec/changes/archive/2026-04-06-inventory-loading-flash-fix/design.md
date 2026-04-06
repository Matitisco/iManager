## Context

`Inventory.tsx` maneja el estado de carga con `isInitialLoading` (bool). Al montar el componente o cambiar de categoría, el effect hace `setItems([])` + `setIsInitialLoading(true)` antes de lanzar el fetch. El total permanece en 0 (valor inicial) o en el valor de la categoría anterior hasta que el fetch resuelve. Durante ese intervalo, el badge y el footer muestran datos incorrectos ("0").

`isInitialLoading` ya existe y ya es `true` durante el intervalo problemático — solo falta usarlo en los dos puntos de render.

## Goals / Non-Goals

**Goals:**
- Ocultar el conteo incorrecto ("0") mientras los datos están en vuelo
- Solución mínima, sin cambios de estado ni lógica de fetching

**Non-Goals:**
- Skeleton rows en la tabla
- Cambiar el modelo de estado o el fetch
- Impactar otros módulos

## Decisions

### Decisión: conditional render basado en `isInitialLoading`

**Badge (header):** Mientras `isInitialLoading`, mostrar un bloque skeleton animado (`animate-pulse`) de ancho fijo en lugar de `{total}`. Al resolver, mostrar el número real.

**Footer:** Mientras `isInitialLoading`, mostrar `"Cargando..."` en lugar de `"Mostrando 0 de 0"`.

**Alternativa descartada — no resetear `total`:** Mantener el total de la categoría anterior durante el loading evitaría el "0" del badge, pero muestra un número incorrecto que luego salta. Confuso para el usuario.

**Alternativa descartada — delay con setTimeout:** Introduce complejidad y race conditions innecesarias.

## Risks / Trade-offs

- **Riesgo mínimo**: cambio de 2 líneas en un solo componente sin tocar lógica de estado
- Si `isInitialLoading` nunca vuelve a `false` (error en fetch silenciado), el skeleton queda visible — pero el `.catch(() => {})` en el effect llama `.finally()` así que siempre se resetea

## Migration Plan

Cambio client-side, sin deploy especial. Se despliega con el próximo push a main → Railway hace el build automáticamente.
