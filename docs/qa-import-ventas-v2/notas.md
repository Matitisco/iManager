# Importar ventas: revisión por fila

Se conserva cada fila no vacía del rango seleccionado. Duplicados internos mantienen una venta por ocurrencia, marcadas para revisar; reimportar reconoce las ocurrencias existentes sin duplicar saldos. Los posibles totales e importes inválidos quedan sin importe imputado, con el valor original y motivo en notas. Los pagos ausentes quedan «Por revisar»; esta marca no genera una deuda. IMEI ausentes, vendidos, archivados o reservados se avisan y no alteran stock.

Las columnas sin asignar se guardan como «Encabezado (origen): valor» en notas. Se conservan además las coordenadas y celdas originales. Notas y marca de revisión se muestran después de importar.

ARS se convierte a USD con la venta diaria blue de la fecha exacta. Cuando falta el histórico, se usa la cotización actual con aviso previo y nota persistida. La cotización revisada queda congelada al confirmar. La serie histórica proviene de [ArgentinaDatos](https://argentinadatos.com/docs/operations/get-cotizaciones-dolares-casa); el valor actual usa el proveedor existente de ventas. No se inventa una cotización si ambos fallan.

Clases reutilizadas: `Sheet`, `sheet-frame`, `sheet-scroll`, `sheet-foot`, `btn2`, `wlink`, `fl`, `dtable compact`, `kv`, `spill`, `imp-table-title`, `imp-sources` e `imp-unused`. CSS aditivo con prefijo `sales-import-`: grilla con scroll interno, asignación por columna y tarjetas móviles. Encabezado, revisión e importe convertido aparecen primero en escritorio. Las capturas `preview-*` y `revision-*` muestran la grilla y los avisos a 1440×900 y 390×844 @2x. Se inspeccionaron las cuatro: sin desborde horizontal de pantalla, pie visible y scroll interno.

Datos: exclusivamente inventados (clientes, IMEI, importes y cotizaciones). Workbook generado en memoria y leído nuevamente como XLSX, sin archivos reales de clientes. Integración sobre PostgreSQL local aislado `imanager_sales_import_test`: vista previa, aplicar mapeo, confirmación, notas persistidas, cotización congelada, separación por tienda, reimportación sin duplicar y rollback completo. Regresiones relacionadas de concurrencia, clientes, comisiones e IMEI opcional. Sin build ni watchers.

`IMPORT_SALES_ENABLED` permanece en `false` como lo dejó #654. El trabajo prepara el flujo para cuando se vuelva a habilitar; no cambia sus accesos. Sin cambios de `periodic-reports`.
