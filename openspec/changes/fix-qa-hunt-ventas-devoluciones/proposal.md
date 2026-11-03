## Why

QA exploratorio sobre `origin/test` reproduce acumulados de clientes incorrectos por moneda, aplicación duplicada de notas y alcance conjunto de reclamos inválido tras editar cantidades.

## What Changes

- Sales/Returns/Clients: convertir el descuento del acumulado a la moneda de la cuenta con la cotización de la venta.
- Aplicar cada ID de nota una sola vez por request.
- Revalidar el alcance conjunto de reclamos dentro de la resolución transaccional.
- Agregar regresiones y documentar hallazgos que requieren decisiones mayores.

## Non-goals

Sin cambios de schema Prisma, permisos (#691), producción, anulaciones financieras integrales, builds ni despliegues. Entrega en `qa/hunt-ventas-devoluciones` mediante PR a `test`, según autorización explícita de esta sesión.
