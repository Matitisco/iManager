## Why

En Devoluciones/RMA, el detalle de un reclamo anulado muestra su única acción Cerrar con ancho intrínseco. En móvil queda un botón casi circular, a diferencia del pie de ancho completo requerido por la guía de diseño. Reproducido con datos ficticios en QA local, captura `060-anulado-detalle-mobile.png`.

## What Changes

- Usar el contenedor existente de una sola acción para el botón Cerrar del detalle anulado.
- Verificar visualmente el cierre en escritorio y móvil y conservar el comportamiento de solo lectura.

## Capabilities

### New Capabilities
- `returns-single-close-action`: distribución de la acción única del reclamo anulado.

## Impact

Solo `src/desk/overlays/return-case.tsx`. Sin cambios de Prisma, backend, AppContext ni estilos compartidos.

## Non-goals

Rediseñar hojas, cambiar historial o navegación, modificar DeskSelect/calendario, cambiar la semántica de anulación o tocar datos de otros grupos.
