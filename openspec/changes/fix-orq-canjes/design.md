## Context
Canjes ya carga movimientos del cliente para calcular anulaciones y tiene disponibles las ventas relacionadas. La fila Deuda solo comprueba si la venta está pendiente y resta señas a la diferencia, ignorando pagos posteriores.

## Goals / Non-Goals
Corregir el importe con el helper existente `displayedSaleDue`, conservando moneda, componentes y persistencia. No cambiar los flujos de cobro ni agregar llamadas de escritura.

## Decisions
Construir un único `RefundTarget` con diferencia, seña, estado, saldo y fecha de la venta. Reutilizar ese target y las ventas/movimientos existentes tanto para deuda como para el plan de anulación. Resolver la venta desde el contexto o desde `loadedOperation.sale`.

## Risks / Trade-offs
La distribución de pagos generales debe coincidir con Ventas: por eso se reutiliza el helper y no se introduce una fórmula propia. La disponibilidad y actualización del contexto siguen sus mecanismos existentes.

## Validation
Regresiones unitarias con pagos generales, saldo explícito y venta fuera de la lista. QA en runtime compartido con un canje ficticio propio, pago parcial real contra API local y recarga, a 1440×900 y 390×844. TypeScript frontend/backend en paralelo; solo tests relacionados con máximo dos workers. Sin build.
