# Diseño

Reutilizar ClientDeposit, su snapshot monetario y applyDeposits dentro de la transacción serializable de createOperation. La clave de la venta evita repetir la operación. La seña nueva convive con recibos anteriores sin superar el importe restante. Requiere cliente y cotización válida; no se combina con cuotas/pagos múltiples.

Agregar Sale.hasInitialDeposit boolean default false. El estado contable sigue PENDIENTE mientras hay openBalance y COMPLETADA al cobrar todo; la UI muestra Seña solamente mientras está pendiente. La anulación restaura el recibo como CREDIT y permite devolverlo desde la ficha, igual que #315/#354. Migración exclusivamente aditiva, sin backfill.
