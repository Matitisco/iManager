## ADDED Requirements
### Requirement: Cobro real y cotización fija
El sistema SHALL guardar monto ARS/USD, cotización, equivalente USD fijo, cobro ClientPayment e historial auditado por tienda.
#### Scenario: Seña ARS
- **WHEN** se registra ARS 100000 con cotización 1000
- **THEN** se conserva USD 100 aunque cambie la cotización.
### Requirement: Reserva exclusiva
El sistema SHALL reservar un equipo disponible para un cliente y mostrar cliente/fecha, bloqueando ventas ajenas y modificaciones que liberen stock sin cancelar la seña.
#### Scenario: Otro comprador
- **WHEN** otro cliente intenta vender el equipo reservado
- **THEN** la operación falla sin efectos parciales.
### Requirement: Aplicación atómica
El sistema SHALL ofrecer Aplicar en Pagos del mismo cliente y descontar el importe de la deuda/restante, conservando precio total y sin duplicar el cobro.
#### Scenario: Venta o reparación
- **WHEN** se confirma una venta nueva o se aplica a una OT del mismo cliente
- **THEN** se consume una sola vez y se conserva el destino en historial y auditoría.
### Requirement: Cancelación
El sistema SHALL permitir devolución o crédito reutilizable, liberar stock y preservar la historia.
#### Scenario: Cancelar reserva
- **WHEN** el usuario elige dejar saldo a favor
- **THEN** se libera el equipo y el crédito sigue disponible.
#### Scenario: Cancelar venta con seña
- **WHEN** se cancela una venta con seña aplicada
- **THEN** la seña vuelve como crédito, y sólo se devuelve el cobro adicional.
### Requirement: Diseño adaptable
El sistema SHALL ofrecer hojas completas en iPhone/Android sin overflow y panel de escritorio, con controles accesibles de al menos 44px.
#### Scenario: Teléfono
- **WHEN** se agrega o cancela una seña
- **THEN** monto, opciones y confirmación funcionan en hoja con safe areas.
