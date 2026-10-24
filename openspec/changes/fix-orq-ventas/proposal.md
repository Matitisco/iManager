## Why
En Sales, los pagos mixtos comparan la suma nominal de ARS y USD contra el saldo de la venta. Un pago USD 100 para una venta ARS 100000 con cotización 1565 oculta la elección del excedente aunque cubre ARS 156500.

## What Changes
Convertir los pagos a la moneda de la venta antes de decidir si mostrar las opciones existentes de excedente. Reutilizar la tolerancia de validación y evitar una comparación engañosa con cotización inválida.

## Capabilities
### New Capabilities
- `sale-payment-preview`: previsualización coherente del excedente de pagos mixtos.

## Impact
Solo `src/desk/overlays/sale-payments.tsx` y sus tests. Sin cambios de API, AppContext ni Prisma.

## Non-goals
No rediseñar Ventas, modificar componentes compartidos, habilitar secciones ocultas ni alterar la liquidación backend.
