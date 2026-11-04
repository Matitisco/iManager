# Revertir caja al anular ventas de consignaciones

W4-02: el cobro de una consignación registra caja sin marcar la venta como integrada. Su anulación devuelve stock pero conserva el cobro.

Corregir la reversión transaccional e idempotente de caja en `deleteSale` y mostrar la devolución en la confirmación. Conservar el historial de la consignación y el flujo de ventas integradas.
