## ADDED Requirements

### Requirement: Excedente en la moneda de la venta
El formulario SHALL convertir los pagos a la moneda de la venta con la cotización ingresada antes de mostrar las opciones de excedente, usando la misma tolerancia de 0.009 de la validación.

#### Scenario: Dólares para una venta en pesos
- **WHEN** la venta es ARS 100000 y el pago USD 100 con cotización 1565
- **THEN** aparecen No registrarlo, Saldo a favor y Vuelto.

#### Scenario: Pesos para una venta en dólares sin excedente
- **WHEN** la venta es USD 100 y el pago ARS 100000 con cotización 1565
- **THEN** no aparecen opciones de excedente.

#### Scenario: Cotización inválida
- **WHEN** un pago requiere conversión y la cotización no es positiva y finita
- **THEN** se mantiene el error de cotización y no se presenta un excedente sin calcular.
