## Context
Conservar análisis, reaplicación y confirmación existentes.

## Decisions
Identidad de layout por columna física y hoja; Modelo fijo primero. Popover con búsqueda y letras de uso, hoja inferior móvil, alta inline. Dos chips con recorridos circulares independientes en orden visual: por revisar para asignadas con review (amarillo), sin asignar para ignoradas sin descarte explícito (rojo). Ambos se ocultan en cero. Precio abre sobre primera libre o primera física filtrando Precio. Escape restaura foco.

## Risks / Trade-offs
El orden y ancho deben sobrevivir a reasignaciones. La recuperación de errores sigue usando el último plan válido.
