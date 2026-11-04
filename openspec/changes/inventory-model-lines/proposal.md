# Inventario por línea (#762)

## Why

Las filas individuales con IMEI dificultan encontrar modelos. La variante A y los defaults están aprobados en el pedido de implementación.

## What Changes

Inventory agrega una vista alternativa por modelo y capacidad, orden por línea, resumen y unidades desplegables. Conserva filtros, vista actual y permisos financieros.

## Non-goals

Sin cambios en backend, AppContext, stock, persistencia de importes, Prisma o migraciones. Sin accesorios ni cambios de otros issues.
