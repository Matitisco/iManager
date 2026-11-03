## ADDED Requirements

### Requirement: Bounded spreadsheet parsing
El sistema MUST limitar tamaño comprimido, expansión real y complejidad de XLSX antes de instanciar ExcelJS; CSV MUST tener un límite de bytes antes de leerlo.

#### Scenario: Malicious compressed or merged workbook
- **WHEN** se recibe una planilla que excede el presupuesto de recursos
- **THEN** se rechaza con error visible antes de procesarla con ExcelJS, sin persistir filas.

#### Scenario: Legitimate padded workbook
- **WHEN** una planilla contiene datos dentro de los límites existentes y padding vacío
- **THEN** se conserva la grilla normalizada y el flujo actual de importación.

### Requirement: Safe named ranges
El sistema MUST rechazar rangos nombrados que permitan contaminar prototipos y acotar las referencias de metadatos que ExcelJS materializa.

#### Scenario: Prototype name in a worksheet reference
- **WHEN** una planilla contiene un rango nombrado con hoja `__proto__`
- **THEN** se rechaza antes de ExcelJS, sin modificar Object.prototype ni persistir filas.

#### Scenario: Ordinary metadata and cached formula results
- **WHEN** una planilla contiene rangos comunes, validaciones de datos acotadas y fórmulas con resultados guardados
- **THEN** el importador conserva los valores leídos y los metadatos de impresión sin ampliar rangos peligrosos.
