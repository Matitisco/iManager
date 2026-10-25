## ADDED Requirements

### Requirement: Formularios comprensibles
El formulario SHALL mantener fecha y acciones visibles y guiar al primer error en cada envío, sin perder datos.

#### Scenario: Envío inválido repetido
- **WHEN** se confirma una venta o canje con datos faltantes
- **THEN** el primer control inválido recibe foco y queda visible, incluso al repetir el envío

#### Scenario: Cobro sin confirmar
- **WHEN** se edita el importe o un pago parcial
- **THEN** el resumen muestra el importe a cobrar sin afirmar que ya se cobró

#### Scenario: Cuotas en móvil
- **WHEN** se abre el primer vencimiento a 390 px
- **THEN** el calendario aparece dentro del flujo y las acciones permanecen visibles
