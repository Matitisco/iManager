## ADDED Requirements

### Requirement: Ventas anuladas al final
El sistema SHALL mostrar ventas activas antes de las anuladas, conservando el orden relativo y aplicando la partición antes de paginar.

#### Scenario: Lista mixta
- **WHEN** una lista filtrada contiene ventas activas y anuladas
- **THEN** las activas aparecen primero en desktop y móvil, sin cambiar su orden actual.

### Requirement: Revertir anulación consistente
El sistema SHALL ofrecer Revertir anulación a miembros con permiso sensible y acceso a Ventas, pedir confirmación y persistir todos los efectos en una transacción.

#### Scenario: Reversión confirmada
- **WHEN** el usuario confirma y los recursos siguen disponibles
- **THEN** se recuperan el estado previo, stock, saldos, señas, caja, canje y comisión correspondientes, con auditoría.

#### Scenario: Conflicto o error
- **WHEN** el estado previo es ambiguo o el stock/crédito ya está en uso
- **THEN** no se aplica ningún efecto y el diálogo permanece con error visible.

#### Scenario: Cancelación y permisos
- **WHEN** el usuario cancela el diálogo o carece del permiso
- **THEN** no se revierte la venta; el backend rechaza solicitudes no autorizadas.
