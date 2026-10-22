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

### Requirement: Acción única de anulación
Ventas y canjes MUST ofrecer únicamente Anular con ReasonSheet y motivo opcional, bajo los permisos sensibles existentes. Las operaciones integradas MUST revertir stock, saldos, pagos y comisiones igual que Cancelar y registrar voidedAt, voidedBy y voidReason atómicamente en venta y canje vinculados.

#### Scenario: Anular operación integrada
- **WHEN** una persona autorizada anula una venta o canje con o sin motivo
- **THEN** se revierte la operación una sola vez y sus registros permanecen rojos en Todos, excluidos de totales.

#### Scenario: Cancelación histórica
- **WHEN** existen registros CANCELADA o CANCELLED sin voidedAt
- **THEN** se muestran como Anulada y el filtro Anulada los incluye junto a las bajas lógicas, sin filtro Cancelada ni migración de datos.
