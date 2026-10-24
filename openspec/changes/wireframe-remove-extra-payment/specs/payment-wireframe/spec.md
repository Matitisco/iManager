## ADDED Requirements

### Requirement: Quitar pagos adicionales
El editor compartido de Venta y Canje SHALL permitir quitar pagos desde el segundo mediante una cruz en su encabezado, sin flag de QA, con área táctil 44×44 y etiqueta accesible «Quitar pago N».

#### Scenario: Quitar un pago intermedio
- **WHEN** se quita el segundo de tres pagos
- **THEN** el tercero conserva su identidad, importe, moneda y medio, pasa a llamarse «Pago 2» y el foco vuelve al importe del pago anterior (o a «Agregar pago» si no está disponible).

#### Scenario: Recalcular el cobro
- **WHEN** se quita un pago que cubría parte del saldo o generaba excedente
- **THEN** el borrador enviado y la previsualización de excedente y cuotas se recalculan con los pagos restantes.

#### Scenario: Conservar el primer pago
- **WHEN** solo queda el primer pago
- **THEN** no se ofrece quitarlo y se permite agregar otro pago hasta el máximo existente de cuatro.
