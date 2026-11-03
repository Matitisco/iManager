# QA del control de canje en Ventas

Investigar el rage click reportado (cinco toques en unos dos segundos) en mobile 390/360 y desktop con Playwright, API y PostgreSQL locales ficticios. El pedido autoriza un fix pequeño con regresión si hay fallo, o feedback visual acotado si el estado resulta confuso.

## Non-goals

Sin producción, cambios de schema, lógica de venta/canje/stock ni reversión de #691. Entrega por PR a `test`; merge únicamente si el cambio es de UI y el CI pasa.
