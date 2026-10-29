## Why
Las ventas anuladas interrumpen el orden de las activas y su menú contextual queda vacío. Hace falta revertir la anulación sin perder consistencia contable.

## What Changes
- Partición estable de ventas activas y anuladas antes de paginar en escritorio y móvil.
- Acción Revertir anulación con diálogo, permisos sensibles y errores visibles.
- Endpoint transaccional con snapshot de efectos, conflictos de stock/crédito, auditoría y reversión de caja, señas y comisiones.

## Impact
Frontend de ventas, operaciones, schema Sale (snapshot nullable) y pruebas relacionadas. PR abierto en fix/anuladas-orden, sin merge.
