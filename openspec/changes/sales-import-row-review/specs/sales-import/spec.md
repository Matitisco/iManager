## ADDED Requirements

### Requirement: Revisión sin pérdidas
El sistema SHALL conservar cada fila no vacía del rango seleccionado, sus coordenadas y columnas no asignadas en notas.

#### Scenario: Duplicados y totales
- **WHEN** una hoja contiene duplicados o posibles totales
- **THEN** la vista previa los marca por revisar y conserva cada fila; los totales no imputan un importe comercial.

#### Scenario: Pagos y stock
- **WHEN** falta el medio de pago o el IMEI no está disponible en stock
- **THEN** se avisa antes de confirmar, se conserva la venta marcada y no se inventa efectivo.

### Requirement: Conversión histórica
El sistema SHALL convertir ventas ARS a USD con la cotización blue de la fecha de venta y conservar importe, moneda y cotización de origen.

#### Scenario: Histórico ausente
- **WHEN** no existe cotización válida de la fecha de venta
- **THEN** usa la de hoy y avisa en la vista previa y las notas persistidas.

### Requirement: Confirmación completa
El sistema SHALL confirmar el archivo en una transacción y reconocer ventas ya importadas.

#### Scenario: Reintento
- **WHEN** se confirma nuevamente el mismo archivo
- **THEN** cada ocurrencia ya persistida se reconoce sin duplicar ventas ni saldos.
