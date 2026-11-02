# Diseño

La API lista todas las ventas por tienda sin take, distinct ni groupBy; el servicio frontend y AppContext conservan esos registros. La ficha combina activos/anulados por ID y clientPurchases genera una fila por operación. visiblePurchases limita solamente el render a tres filas después del cálculo de totales. purchaseTotals.count cuenta operaciones activas; no debe sumar cantidad.

El defecto comprobable está en activeWarranties: usa filter(...).length, por lo que cuatro ventas de cantidades 2, 3, 1 y 1 producen cuatro garantías en lugar de siete. Conservar cantidad numérica en ClientPurchase, normalizada con saleQuantity (históricos sin cantidad = 1), y sumar unidades solo en coberturas vigentes/por vencer. Reparaciones conservan una unidad y canjes no aportan cobertura. Los importes ya son totales por venta y no se multiplican.

Sin datos del caso real no se puede atribuir el cuatro de Compras a agrupación ni afirmar que siete unidades sean siete operaciones. Probar por separado siete IDs con el mismo producto/fecha y cuatro operaciones con siete unidades. Sin cambios de esquema ni acceso a BD.
