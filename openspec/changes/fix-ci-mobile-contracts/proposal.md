## Why
El CI completo de main falla porque varios E2E siguen usando contratos de presentación anteriores a #551, #567, #572 y #574.

## What Changes
Actualizar únicamente los selectores y la navegación E2E de ventas, comisiones, dashboard, clientes, canjes, historial de reparaciones y configuración del reporte. Conservar persistencia, cálculos, permisos y límites de pantalla verificados.

## Non-goals
Cambios de UI, lógica de negocio, schema Prisma, timeouts, skips o reducción de asserts. No acceder a producción.

## Impact
Solo E2E y documentación; reproducción antes/después con PostgreSQL local aislado y máximo dos workers.
