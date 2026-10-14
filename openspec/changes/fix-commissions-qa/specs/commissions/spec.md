## ADDED Requirements

### Requirement: Gestión de reglas y pagos
El sistema SHALL permitir a OWNER o miembros con commissions activar, desactivar y eliminar reglas y anular pagos con confirmación y auditoría, conservando historia.

#### Scenario: Regla desactivada
- **WHEN** se desactiva o elimina una regla
- **THEN** no se aplica a nuevas ventas y los snapshots existentes permanecen intactos.

#### Scenario: Pago anulado
- **WHEN** se confirma la anulación de un pago
- **THEN** queda registrado como anulado y no participa en totales o ajustes.

### Requirement: Bajas pagadas
El sistema SHALL computar cero comisión para ventas canceladas o eliminadas y trasladar el exceso pagado como A descontar por moneda al mes siguiente.

#### Scenario: Pago parcial y eliminación
- **WHEN** una venta con comisión USD 20 pagada USD 10 se cancela y elimina
- **THEN** ganado es cero, saldo es USD -10 y el siguiente mes tiene un ajuste USD -10 sin duplicar el débito en resumen, detalle o Reportes.

### Requirement: Detalles de interfaz
El sistema SHALL encontrar equipos sin Estado, pluralizar venta y usar Propietario en permisos.

#### Scenario: Equipo sin Estado
- **WHEN** se busca un equipo sin Estado en una nueva venta
- **THEN** el equipo aparece como opción disponible.
