## ADDED Requirements

### Requirement: Repeated lines within one import
El sistema SHALL agrupar filas sin IMEI con la misma clave estricta administrativa dentro de un único import, sumando sus cantidades (ausente = 1), tanto en preview como al confirmar Excel, texto y onboarding.

#### Scenario: Cantidades repetidas
- **WHEN** el import contiene dos filas idénticas sin IMEI de cantidades 2 y 3
- **THEN** preview y persistencia muestran una fila de cantidad 5 y conservan las unidades

#### Scenario: Diferencias e identificadores
- **WHEN** las filas difieren en cualquier campo de la clave o tienen IMEI
- **THEN** permanecen separadas y se mantienen las validaciones actuales

#### Scenario: Stock previo
- **WHEN** existe una fila idéntica sin IMEI en la tienda
- **THEN** no se modifica; solo se agrupan filas del nuevo import
