# Compras por proveedor por unidades

## Why
El resumen de compras de Inventory cuenta filas y costos unitarios en cargas manuales e importadas. Las ventas mutan el stock y las devoluciones pueden crear filas adicionales.

## What Changes
Separar cantidad adquirida histórica del stock mediante InventoryItem.acquiredQuantity nullable; migración aditiva con backfill seguro. Sumar inversión por unidades adquiridas y stock por unidades remanentes. Convertir regresiones QA en pruebas normales y ampliar cobertura.

## Non-goals
Sin cambios de permisos #691, producción, borrado de datos, merge ni valuación de stock en otros módulos. Entrega mediante PR contra test.
