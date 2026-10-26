## ADDED Requirements

### Requirement: Unidades de planillas sin IMEI
El importador MUST conservar la cantidad de equipos indicada en columnas Cantidad cuando la fila no tiene IMEI.

#### Scenario: Cinco unidades sin IMEI
- **WHEN** se importa iPhone 13 con Cantidad 3 y precio USD 400 e iPhone 14 con Cantidad 2 y precio USD 500
- **THEN** MUST generar cinco equipos y conservar USD 2200 de valor total

#### Scenario: Identidad individual
- **WHEN** una fila tiene un IMEI y una columna Cantidad mayor a uno
- **THEN** MUST representar un único equipo sin multiplicar su identidad

#### Scenario: Sin columna Cantidad
- **WHEN** el archivo no incluye Cantidad
- **THEN** MUST conservar una unidad por fila
