## Context
Reutilizar ClientPayment para cobros/devoluciones y RepairOrder.deposit para anticipo aplicado. Mantener Sale.amount como precio total.
## Decisions
ClientDeposit conserva recibo original, moneda, cotización, equivalente USD, estado y destino histórico (incluso si se borra la venta). Inventario guarda cliente y fecha de reserva. Transacciones serializables protegen reserva y consumo. Las aplicaciones no generan otro ingreso. El crédito vive separado de la deuda existente y sigue disponible en Pagos.
Aplicación completa, sin división de señas; rechazar excesos. Misma moneda conserva monto nominal, cambio a USD usa equivalente congelado, cambio USD→ARS usa cotización explícita al aplicar. En anulaciones de venta, reactivar como crédito, liberar equipo y devolver solamente el efectivo adicional. Bloquear cambios financieros de operaciones con señas que alteren su aplicación; cancelar y crear de nuevo.
Interfaz usa Sheet, Field, Segs y botones actuales. Señas seleccionables en Pagos, historial en ficha, confirmación en hoja móvil, controles de 48px.
## Pending product decisions
Caja diaria #307; aplicación parcial, alertas por antigüedad y reservas por turnos #313; devolución de reparaciones fuera del flujo de venta. Reparaciones con señas aplicadas no permiten borrar ni reducir anticipo/cambiar cliente o moneda.
