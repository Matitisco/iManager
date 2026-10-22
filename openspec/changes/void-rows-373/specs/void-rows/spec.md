## ADDED Requirements

### Requirement: Registros archivados y anulados visibles
Los listados MUST mostrar en rojo las filas con voidedAt, archivedAt, deletedAt o estado CANCELADA, CANCELLED o ANULADA.

#### Scenario: Todos y filtros específicos
- **WHEN** se elige Todos
- **THEN** se consultan y muestran también los registros archivados o anulados; los filtros de estado activo los excluyen y Archivados sigue disponible.

### Requirement: Motivo de archivo o anulación
Las acciones MUST reutilizar el modal de motivos con chips y guardar el motivo en auditoría.

#### Scenario: Error al guardar
- **WHEN** falla el backend al archivar o anular
- **THEN** el modal permanece abierto con error y conserva el motivo elegido.
