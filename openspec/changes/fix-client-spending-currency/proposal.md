## Why
W4-01: cobrar ARS 500.310 de una consignación suma USD 500.310 al cliente en lugar de USD 500,31. Las ventas directas y sus recálculos también suman importes nominales.

## What Changes
- Compartir la conversión monetaria existente de operaciones integradas con ventas directas, consignaciones, importación y recálculos.
- Usar la moneda del cliente (o tienda para registros sin moneda) y la cotización histórica de cada venta, con precisión decimal.
- Agregar regresiones sobre PostgreSQL local exclusivo.

## Impact
Backend monetario y pruebas. Sin schema, backfill, frontend, build, push ni servicios remotos.
