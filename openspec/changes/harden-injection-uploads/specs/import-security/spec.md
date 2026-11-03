## ADDED Requirements

### Requirement: Bounded spreadsheet parsing
El sistema MUST limitar tamaño comprimido, expansión real y complejidad de XLSX antes de instanciar ExcelJS; CSV MUST tener un límite de bytes antes de leerlo.

#### Scenario: Malicious compressed or merged workbook
- **WHEN** se recibe una planilla que excede el presupuesto de recursos
- **THEN** se rechaza con error visible antes de procesarla con ExcelJS, sin persistir filas.

#### Scenario: Legitimate padded workbook
- **WHEN** una planilla contiene datos dentro de los límites existentes y padding vacío
- **THEN** se conserva la grilla normalizada y el flujo actual de importación.
