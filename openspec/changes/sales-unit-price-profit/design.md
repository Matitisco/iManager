# Diseño

Agregar `unitPrice` opcional al tipo Sale para consumirlo cuando exista; usar `amount / saleQuantity(sale)` como alternativa. Formatear con `money.show` y máximo dos decimales, en la misma moneda que Total.

Reutilizar `summarizeSaleProfit` por fila y `seeFinancials`, igual que el KPI Ganancia total. Descontar costo unitario por cantidad con la conversión existente; mostrar «—» cuando no hay costo conocido, la conversión está bloqueada o la venta está anulada. Mantener clases de tabla y privacidad existentes para respetar modo oscuro.

Modificar solo el render de escritorio. Quitar encabezado, filtro y celda Pago; conservar el comportamiento de los demás filtros. Sin cambios de API, esquema, persistencia ni cards móviles.
