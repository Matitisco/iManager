## Context
CatalogPreview consulta fetchPublicCatalog al montar y cuando cambian slug o teléfono. Las mutaciones de visibilidad/reglas reemplazan el objeto ManagedCatalog sin modificar necesariamente esos valores, por lo que la vista conserva un resultado anterior.

## Goals / Non-Goals
Sincronizar la vista previa tras persistir visibilidad, reglas y precio, conservando los componentes y tokens existentes. No cambiar fuentes de datos, backend, diseño general, navegación ni selectores compartidos.

## Decisions
Usar el catálogo administrado como dependencia de la consulta pública existente. Mantener la vista previa resuelta mientras llega la nueva respuesta para evitar parpadeos. Conservar AbortController y la comprobación de cancelación para impedir que una respuesta anterior reemplace la vigente; ocultar la vista secundaria si la consulta falla, como hasta ahora.

## Risks / Trade-offs
Cada reemplazo del catálogo puede iniciar una nueva lectura pública; son lecturas derivadas de actualizaciones de negocio y la anterior se cancela. No se disparan consultas por búsqueda o paginación local.

## Validation
Regresiones de revalidación y respuesta tardía, TypeScript frontend/backend en paralelo y solo tests relacionados con máximo dos workers. QA Chromium 1440×900 @1x y 390×844 @2x, capturando e inspeccionando cada acción. No build ni nuevas apps. Evidencia fuera de git en /workspace/qa-orq/stock.
