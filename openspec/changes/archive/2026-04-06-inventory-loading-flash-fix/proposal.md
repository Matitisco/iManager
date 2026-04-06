## Why

Al cargar Inventario por primera vez o al cambiar de categoría, el estado inicial (`total = 0`, `items = []`) queda expuesto durante el intervalo entre el reset de estado y la resolución del fetch. Esto produce un flash visible de "0" en el badge del header y "Mostrando 0 de 0" en el footer antes de que lleguen los datos reales. Es un artefacto de la UI que degrada la percepción de calidad del producto (issue #30).

## What Changes

- Mientras `isInitialLoading === true`, el badge de conteo en el header muestra un skeleton animado en lugar de "0"
- Mientras `isInitialLoading === true`, el footer muestra "Cargando..." en lugar de "Mostrando 0 de 0"
- No se modifica la lógica de fetching ni el estado — solo la representación visual durante el loading

## Capabilities

### New Capabilities
- ninguna

### Modified Capabilities
- `inventory-inline-edit`: No cambia. (Mencionado por estar en el mismo archivo — sin cambio de requisitos)

El cambio no introduce nuevas capabilities ni modifica requisitos observables de las specs existentes. Es un fix de presentación dentro del componente Inventory.

## Impact

- `src/pages/Inventory.tsx`: 2 puntos de render (badge line ~1185, footer line ~1636)
- Sin cambios en backend, Prisma, servicios HTTP ni AppContext
- Sin cambio de schema

## Non-goals

- No agregar skeleton rows en la tabla (scope separado)
- No cambiar el comportamiento del fetch ni el modelo de estado
- No afectar otros módulos fuera de Inventory
