## Why
En Análisis / Fallas, abrir un reclamo desde el grupo o Todos los reclamos mantiene montada la hoja de origen. Abrir después el historial produce tres diálogos simultáneos y excede el límite de dos capas.

## What Changes
- Suspender la hoja de origen mientras se consulta el reclamo.
- Recuperar la lista y el foco del reclamo al volver.
- Cubrir ambos puntos de entrada en escritorio y móvil.

## Capabilities
### New Capabilities
- `fallas`: consulta de reclamos con dos capas como máximo.

## Impact
Solo ReturnsPatterns y sus pruebas. Sin cambios de backend, Prisma, AppContext ni componentes compartidos.

## Non-goals
Rediseño, modificación del historial compartido, lógica financiera o datos de otros grupos.
