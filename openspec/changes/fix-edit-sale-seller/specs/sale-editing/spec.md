## ADDED Requirements

### Requirement: Cancelled sales are read-only
El sistema MUST ocultar Editar en detalle y menú de ventas canceladas y bloquear el guardado de formularios abiertos.

#### Scenario: Stale cancelled sale form
- **WHEN** se abre una venta CANCELADA para editar
- **THEN** se muestra el aviso y guardar está deshabilitado, sin enviar cambios

### Requirement: Seller-only edits preserve the sale
El sistema MUST persistir vendedor, auditoría y comisión sin modificar importe, moneda, estado o cliente.

#### Scenario: Seller changed with deposits and currency conversion
- **WHEN** se cambia solo vendedor de una venta activa con seña o moneda de visualización diferente
- **THEN** se conserva el importe y moneda original, la diferencia del canje antes de señas, y se actualizan vendedor y comisión

### Requirement: Save errors are visible
El sistema MUST desplazar a la vista el error de guardado.

#### Scenario: Save rejected
- **WHEN** guardar produce un error
- **THEN** el formulario sigue abierto y desplaza el aviso a la vista
