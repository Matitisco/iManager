## Why

El issue #81 pide que el indicador de batería de Inventario en `hifi-desk` replique los colores y la animación de `main`. Actualmente todas las barras son lima y aparecen directamente con su ancho final.

## What Changes

- Reutilizar los umbrales y colores de `batteryColor` de la referencia.
- Animar el llenado desde cero con `motion/react`, como en `main`.
- Usar los helpers de la referencia para conservar porcentajes, rangos y fracciones decimales.

## Capabilities

### New Capabilities

- `inventory-battery-indicator`: indicador visual de batería en el inventario hi-fi.

### Modified Capabilities

Ninguna.

## Impact

Frontend: `src/desk/ui.tsx`, `src/desk/screens/InventoryScreen.tsx` y el CSS del indicador. Se reutiliza `src/utils/inventory.ts`. Sin cambios de schema Prisma, API ni dependencias.

## Non-goals

No cambiar la paleta general (#86), editar datos de inventario ni agregar filtros, columnas o funcionalidades de otros issues.
