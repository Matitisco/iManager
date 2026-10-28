## ADDED Requirements

### Requirement: Importación confiable por contenido
El sistema SHALL priorizar la heurística validada, conservar moneda y notas, reportar errores por fila en español y procesar confirmaciones en lotes recuperables.

#### Scenario: Stock anonimizado sin encabezado
- **WHEN** se analiza e importa el stock anonimizado con IMEI duplicado
- **THEN** se reconoce costo en I, se rechaza sólo el duplicado y reimportar equipos identificados actualiza sin duplicar

#### Scenario: Moneda ambigua e importes inválidos
- **WHEN** costo carece de moneda o contiene texto inválido
- **THEN** se advierte la moneda por defecto o se rechaza la fila con motivo claro sin guardar cero silenciosamente

#### Scenario: Corte de conexión
- **WHEN** falla un lote tras guardar otros
- **THEN** se devuelven conteos parciales, filas originales y un mensaje de recuperación en español
