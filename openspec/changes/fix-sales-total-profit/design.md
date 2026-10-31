# Diseño

Función pura en `src/desk/sale-profit.ts`, con `projectAmount` y la moneda/cotización de `useMoney`. Convierte cada costo unitario antes de multiplicarlo por `saleQuantity`, igual que `knownCost` en reports; convierte por separado el total de la venta. Excluye anulaciones y costos desconocidos. El porcentaje usa únicamente ingresos con costo conocido. Una conversión bloqueada produce ganancia/porcentaje nulos.

La prueba de paridad ejecuta `getReportsOverview` real (incluido `summarizeCompleted`) con Prisma y cotización simulados, sin DB. Compara sus resultados con la función frontend para los mismos datos completados, cantidad 5 y monedas ARS/USD, incluyendo redondeo unitario. Ventas conserva su alcance de todas las no anuladas del período; Dashboard conserva completadas y ajustes por devoluciones.

Ejemplo sintético, dólar venta $ 1.000: venta de 5 equipos por US$ 800, costo unitario US$ 100 → US$ 300; otra de 5 por US$ 1.000, costo unitario $ 120.000 → US$ 400. Ganancia total US$ 700 ($ 700.000).
