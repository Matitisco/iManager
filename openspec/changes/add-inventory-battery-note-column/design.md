## Context
`InventoryScreen` renderiza una tabla desktop con scroll horizontal y tarjetas mobile. No tiene selector de columnas ni controles de redimensionado.

## Decisions
- Agregar encabezado y celda después de Batería, usando `item.batteryNote`.
- Limitar solo el contenido de la nueva celda a 180 px con elipsis, sin cambiar anchos existentes.
- En móvil, agregar una línea identificada como «Detalle batería» después de las especificaciones de batería, limitada al ancho disponible.
- Usar `title` con el texto original completo; valores ausentes o de solo espacios se presentan como «—».

## Validation
Verificar orden, texto completo y valores vacíos en pruebas del componente; revisar elipsis y geometría a 1440 y 390; lint de ambos paquetes y build frontend.
