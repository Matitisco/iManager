## ADDED Requirements

### Requirement: Vistas por usuario y tienda
El sistema SHALL persistir la versión vista de los registros de Inventario, Ventas, Canjes y Clientes por usuario y tienda.

#### Scenario: Apertura de sección
- **WHEN** el usuario abre una sección con novedades
- **THEN** reconoce todas las versiones observadas, desaparece su contador en las navegaciones y conserva las marcas durante esa visita
- **AND** otro usuario y las otras secciones mantienen sus pendientes

#### Scenario: Cambios concurrentes
- **WHEN** un registro cambia después de obtener su versión y antes de reconocerla
- **THEN** esa nueva versión continúa pendiente incluso después de recargar

#### Scenario: Refresco durante una visita abierta
- **WHEN** el refresco descubre versiones posteriores a la instantánea de entrada
- **THEN** conserva esas versiones pendientes para la próxima visita sin reconocerlas con la tabla anterior

### Requirement: Presentación de novedades
El sistema SHALL priorizar los registros con novedades antes de paginar y marcarlos sutilmente, sin etiquetas ni descripciones adicionales.

#### Scenario: Modificación de un registro antiguo o anulado
- **WHEN** hay novedades de alta, edición o archivo/anulación
- **THEN** aparecen primero dentro del filtro vigente, incluidos registros cancelados y archivados, conservando su estado visual

#### Scenario: Error de persistencia
- **WHEN** falla el reconocimiento
- **THEN** muestra un error y conserva los pendientes para reintentar
