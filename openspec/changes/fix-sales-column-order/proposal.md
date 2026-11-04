# Orden de columnas de Ventas

## Why
En Sales de escritorio, agrupar Precio unit. junto a Total facilita comparar ambos importes.

## What Changes
Mover Precio unit. después de Vendedor e inmediatamente antes de Total, conservando encabezados y celdas alineados.

## Non-goals
Sin cambios móviles, de cálculos, permisos, filtros, orden de filas, API ni schema Prisma.

## Impact
Render de escritorio y pruebas de `SalesScreen`. Entrega en `fix/ventas-col-order` por PR contra `test`.
