## Why
El detalle de Canjes muestra toda la diferencia como deuda mientras la venta está pendiente, incluso después de pagos parciales. QA local reprodujo una diferencia de $300.000 y un pago de $100.000: el cliente debe $200.000, pero Canjes muestra $300.000 tras recargar.

## What Changes
- Reutilizar el cálculo de deuda existente de Ventas en el detalle de Canjes.
- Usar la venta cargada con la operación cuando no está en la lista global.
- Cubrir pagos parciales, saldo explícito y venta recuperada con pruebas relacionadas.

## Capabilities
### New Capabilities
- `trade-detail`: deuda consistente con pagos y saldo del cliente.

## Impact
Solo `src/desk/overlays/trade.tsx` y tests relacionados. Sin cambios de Prisma, backend, AppContext ni componentes compartidos.

## Non-goals
Rediseño, cambios de historial/selectores compartidos, navegación, producción, migraciones y modificación de fixtures ajenos.
