## Context
ServiceScreen usa archivedMode para elegir la fuente. Actualmente también lo usa para omitir las condiciones de estado y forzar todos los grupos móviles, por lo que los chips dejan de filtrar en Archivados. Evidencia ficticia: /workspace/qa-orq/atencion/46-service-archived-filter-bug.png.

## Goals / Non-goals
Corregir únicamente la composición de filtros existentes y mantener los estilos reales. No modificar endpoints, schema, permisos, acciones o componentes compartidos.

## Decisions
- Conservar la exclusión de archivados en los chips activos cuando archivedMode es false.
- Aplicar la comparación con repairColumnStatus para un estado específico independientemente de archivedMode.
- Aplicar ABIERTAS también en archivados, excluyendo REPAIR_DELIVERED como ya ocurre en la vista activa.
- Seleccionar grupos móviles por estado sin excepción para archivados. Mantener el comportamiento de Todos y los estados históricos normalizados.
- Conservar búsqueda, orden, contadores y marcado is-void existentes.

## Risks / Trade-offs
Al activar Archivados se conserva el chip previo: puede resultar vacío y es el resultado correcto del filtro compuesto. La corrección sólo cambia la selección de registros, sin persistencia nueva.

## Validation
Regresión de integración React en desktop y móvil, con fuentes archivadas simuladas y mezcla de estados. Retest Chromium local 390x844 @2x y 1440x900 @1x sobre la orden QA atencion. TypeScript frontend/backend en paralelo; sin build ni suite completa.
