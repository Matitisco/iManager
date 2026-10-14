## ADDED Requirements

### Requirement: Devengado y liquidación por moneda
El sistema SHALL calcular comisión en la moneda de la venta con regla personal vigente o de equipo; sin vendedor SHALL dar cero. El sistema MUST conservar la regla aplicada sin recálculo retroactivo.

#### Scenario: Pago parcial y baja posterior
- **WHEN** se paga parte de un período y se cancela o elimina una venta devengada
- **THEN** el devengado histórico se conserva y una reversión A descontar pasa al mes siguiente; el saldo continúa por moneda.

### Requirement: Acceso restringido
El sistema MUST exigir Comisiones para administrar reglas, pagos, vendedores en masa y datos de equipo. Reportes SHALL exigir también Reportes. Mis comisiones SHALL mostrar solo al miembro actual y nunca costos ni ganancia.

#### Scenario: Miembro sin permiso explícito
- **WHEN** un STAFF o MANAGER con sections null intenta consultar el equipo
- **THEN** se deniega; mine sigue disponible con los datos propios.

### Requirement: Alta explícita de vendedor
El sistema SHALL aceptar vendedor opcional, registrar al usuario actual y guardar la cotización en todas las nuevas ventas sin asignar vendedor por defecto.

#### Scenario: Venta sin vendedor enviado
- **WHEN** se crea o importa una venta sin vendedor
- **THEN** sellerMemberId queda null y la venta no suma comisión.
