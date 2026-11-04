## Approach
Extraer la conversión ARS/USD de operaciones integradas a money-currency. Usar Decimal y redondeo a dos decimales por movimiento; exigir cotización positiva sólo cuando las monedas difieren y el importe no es cero.

Ventas directas y cobros de consignación incrementan totalSpent con el importe convertido. La importación conserva la venta normalizada a USD y convierte ese valor una sola vez para el cliente. Los recálculos suman cada venta en moneda del cliente con su propio exchangeRate y excluyen anuladas/borradas. Ediciones de moneda o cotización también disparan recálculo. Una cotización histórica faltante impide el cambio y revierte la transacción.

Validar sólo en fix_w401_integration, PostgreSQL 127.0.0.1:55404, datos ficticios. No reparar acumulados históricos automáticamente.
