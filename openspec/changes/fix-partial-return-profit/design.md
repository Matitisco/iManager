# Diseño

Mantener itemCost unitario y agregar saleQuantity al DTO de devoluciones, con default histórico 1. La reversión de costo es costo unitario × cantidad vendida × importe devuelto / importe vendido. Reconocer solo compensaciones emitidas, por su fecha, excluyendo anuladas y reparaciones. Respetar las monedas y bloquear conversiones sin cotización.

Ventas descuenta devoluciones del período en sus KPIs y las asociadas a cada venta en su ganancia. Clientes descuenta las devoluciones asociadas en el gasto derivado compartido por ficha/lista, conservando importaciones y reparaciones. Dashboard usa overview: ajustar facturación, ganancia y denominador del margen también en comparación. Reportes ajusta facturación del período y costo por cantidad en ganancia neta.

Pruebas de integración Fastify + Prisma con PostgreSQL nuevo local y datos sintéticos: 10 unidades, devolución de 2, reintegro/nota de crédito, ARS/USD, períodos y paridad con funciones frontend. Agregar regresiones de render de Ventas/Reportes/Clientes. No modificar AppContext.
