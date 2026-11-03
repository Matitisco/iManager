## ADDED Requirements

### Requirement: Ganancia de reparación sólo en pantalla
El frontend SHALL mostrar Ganancia = abonado − costo en alta, edición y detalle, con la misma regla financiera de Ventas, sin guardarla ni cambiar saldo o reportes.

#### Scenario: Permiso financiero
- **WHEN** la membresía tiene acceso financiero según canSeeFinancials, incluido STAFF
- **THEN** muestra la fila y el cálculo con el formato monetario de la vista

#### Scenario: Sin permiso financiero
- **WHEN** la membresía no tiene acceso financiero
- **THEN** ni la fila ni su valor existen en el DOM

#### Scenario: Montos faltantes y cero
- **WHEN** falta un monto o no es finito
- **THEN** la ganancia es «—»

#### Scenario: Abonado cero explícito
- **WHEN** el abonado es cero y el costo está cargado
- **THEN** la ganancia es negativa por el importe del costo
