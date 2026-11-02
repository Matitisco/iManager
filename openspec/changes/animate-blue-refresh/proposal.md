## Why
El botón de recarga del dólar Blue no indica que la consulta sigue en curso cuando ya existe una cotización en caché (#697).

## What Changes
- Girar únicamente el ícono de recarga de la barra lateral mientras su consulta está pendiente.
- Detener el giro al resolver con éxito o error y respetar movimiento reducido.

## Capabilities
### New Capabilities
- `blue-refresh-animation`: indicador visual de recarga del dólar Blue.

## Impact
Frontend: widget BlueDollar, contrato asíncrono de ExchangeProvider y pruebas automatizadas. Sin cambios de schema Prisma.

## Non-goals
No cambiar precios, mensajes, colores, lógica de consulta, persistencia ni la calculadora. Sin cambios en main, producción o datos; entrega mediante PR contra test.
