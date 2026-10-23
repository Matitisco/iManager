## Why
Parte de #374. El acceso a Resumen periódico desaparece al abrir Historial o Comisiones porque sólo ReportsScreen construye esa pestaña y su selección vive en un useState local.

## What Changes
- Integrar Resumen periódico a las pestañas compartidas de Análisis.
- Representar su selección mediante una ruta del escritorio, respetando el permiso Reportes.
- Cubrir todas las transiciones, recarga e historial del navegador sin modificar el diseño de las pantallas.

## Capabilities
### New Capabilities
- `periodic-summary-navigation`: acceso estable al resumen desde Análisis.

## Impact
Frontend de escritorio/móvil, registro de navegación, rutas y pruebas. Sin cambios de API, schema ni scheduler.
