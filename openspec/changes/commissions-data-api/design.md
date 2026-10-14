# Diseño

Migración aditiva: vendedor nullable con SetNull, registrador y cotización en Sale; reglas y pagos por tienda. CommissionAccrual conserva el cálculo y la regla aplicada, independiente del borrado físico. Cambiar reglas no modifica registros existentes. Una baja sin pagos anula el devengado; con pagos conserva el crédito histórico y registra su reversión en el mes siguiente a la baja (nunca antes del período original). Pagos parciales consumen deuda en settlesCurrency a su propia cotización. Saldos se arrastran por moneda; proyecciones usan la cotización guardada de cada devengado/pago y cotización actual para registros legados.

Reutilizar períodos zonificados, selección de regla y estructura de rutas/servicios/tests de origin/hifi-desk-extras. Eliminar accesorios y exportaciones. Comisiones requiere permiso explícito para no propietarios; mine filtra por el miembro actual y omite siempre costos/ganancia. Reportes requiere Reportes y Comisiones.
