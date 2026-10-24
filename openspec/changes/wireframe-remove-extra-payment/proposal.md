# Quitar pagos adicionales en Venta y Canje

Matias eligió la variante 1 documentada en `/workspace/qa-pago/PROPUESTA.md`: cruz en el encabezado «PAGO N · USD», desde el segundo pago. Implementar el fix definitivo en `SalePaymentsFields`, compartido por Venta y Canje, retirando el flag de QA y la variante 2.

Conservar la identidad y los valores de los pagos restantes, renumerar sus etiquetas, recalcular el borrador y devolver el foco al pago anterior o a «Agregar pago». Integrar el estilo en `desk.css`, verificar con tests de componente y QA local a 1440/390, y publicar por PR con CI verde.
