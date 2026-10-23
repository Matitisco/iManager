## Context
ReportsScreen duplica GroupTabs y agrega una pestaña local. Las otras pantallas reconstruyen sus enlaces desde pageTabs sin conocer el resumen.

## Goals / Non-Goals
Mantener el acceso y selección al navegar, recargar y recorrer el historial. Conservar textos, estilos y permisos existentes; no rediseñar ni modificar el envío automático por correo.

## Decisions
Registrar periodicSummary como destino de Análisis con ruta canónica propia y autorización delegada a reports. Reutilizar GroupTabs para las cuatro pantallas. Mantener Resumen periódico al final de la fila y el scroll horizontal existente. El contenido sigue siendo PeriodicSummary, sin cambios de datos.

## Risks / Trade-offs
El nuevo destino debe respetar el permiso Reportes incluso por enlace directo. Verificar usuarios con y sin ese permiso, selección exclusiva, transiciones entre todas las pestañas y restauración por historial.
