## Why
La vista «Así lo ven tus clientes» queda desactualizada después de cambiar la visibilidad o las reglas del catálogo. QA local reprodujo un contador de un equipo publicado junto a una vista previa vacía.

## What Changes
- Refrescar la vista previa cuando cambia el catálogo administrado tras una operación persistida.
- Mantener la vista previa anterior durante la revalidación y descartar respuestas obsoletas.
- Añadir regresiones y validar Stock, Catálogo y Control de stock con datos ficticios en la app local compartida.

## Capabilities
### New Capabilities
- `catalog-preview`: sincronización de la vista previa con cambios guardados.
### Modified Capabilities
Ninguna.

## Impact
Solo PublicCatalogScreen y sus tests. Sin backend, Prisma, AppContext ni componentes compartidos. Los selects de Inventario/equipo ya usan DeskSelect desde #544; no necesitan migración adicional.
