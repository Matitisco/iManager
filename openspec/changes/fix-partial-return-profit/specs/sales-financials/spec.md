## ADDED Requirements

### Requirement: Ganancia y facturación netas de devolución parcial
Sales, Dashboard, Clients y Reports MUST descontar el importe devuelto de la facturación y (precio unitario - costo unitario) × unidades devueltas de la ganancia, respetando monedas y fecha de emisión.

#### Scenario: Diez unidades con devolución de dos
- **WHEN** se venden 10 unidades a 100 con costo unitario 60 y se emite una compensación por 200
- **THEN** la facturación neta es 800, el costo neto 480 y la ganancia 320

#### Scenario: Compensación en otro período
- **WHEN** la venta se registra en un período y la compensación en el siguiente
- **THEN** la venta conserva sus importes en el primer período y el siguiente registra -200 de facturación y -80 de ganancia

#### Scenario: Reparación o reclamo pendiente
- **WHEN** no existe compensación comercial emitida o el reclamo está anulado
- **THEN** el reclamo no reduce facturación ni ganancia
