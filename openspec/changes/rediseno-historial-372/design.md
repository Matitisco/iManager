## Context
Reutilizar HistoryEvent, filtros HTTP, ListSkeleton y Sheet (foco, Escape, scroll y safe area). La propuesta y las cuatro imágenes de #372 ya están aprobadas. El CLI OpenSpec no está instalado en este entorno; se registran los cuatro artefactos manualmente antes de implementar.

## Decisions
- CSS acotado a historial: cuatro columnas desktop, filas apiladas mobile, modal centrado y hoja inferior.
- Agrupar y ordenar por día de Argentina, coherente con las horas existentes. La fecha incluye año; Hoy/Ayer acompañan la fecha.
- Leer diferencias de changes exclusivamente. detail se conserva como texto libre, sin inferir valores anteriores. Mantenerlo también en el historial compartido de registros.
- Agregar entityIdentifier opcional al contrato, resuelto por tienda desde InventoryItem.imei. La etiqueta histórica sigue identificando al registro si no existe el equipo.
- Conservar paginación; descartar respuestas tardías al cambiar usuario, tienda o filtros. Reintentos y errores visibles.
- Ofrecer acciones solo para destinos soportados, existentes y autorizados; cargar archivados antes de navegar, mostrando los errores.

## Validation
Tests unitarios de fechas, agrupación y diferencias; integración de pantalla con API simulada para filtros, paginación y detalle; pruebas de servicio backend para identificadores y aislamiento por tienda; TypeScript frontend/backend. Revisión visual a 1440 y 390 sin build ni E2E.
