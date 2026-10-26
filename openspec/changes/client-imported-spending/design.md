# Diseño

Guardar importedSpent e importedSpentCurrency separados de totalSpent. Importe no negativo y moneda ARS/USD explícita; una reimportación reemplaza el histórico, nunca lo incrementa. Omitir la columna conserva el valor previo. Las ventas/reparaciones conservan la definición de #576 y las monedas se agrupan sin sumar ARS con USD. El histórico corresponde a compras previas a iManager; no importar los mismos comprobantes también como ventas. Los datos ya descartados deben reimportarse desde Excel.

## Presentación de esta variante
A: total combinado en lista/ficha con indicación discreta de histórico. Filtros y orden por gasto usan el combinado.
