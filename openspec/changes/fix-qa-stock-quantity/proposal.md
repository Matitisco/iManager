## Why
La QA 02 comprobó que las columnas Cantidad de CSV/XLSX se descartan y cinco unidades quedan como dos.

## What Changes
- Reconocer la columna Cantidad y expandir filas sin IMEI a una fila por unidad.
- Mantener una unidad por IMEI y no modificar componentes de UI.

## Impact
Parser y planes de inventario; sin schema, layout, estilos, textos nuevos ni servicios externos.
