## ADDED Requirements

### Requirement: Descartes compactos en variante C
El importador SHALL mostrar un indicador de una línea con la cantidad descartada y acceso al detalle, fuera del bloque inferior de la tabla. El detalle MUST agrupar por tipo, mostrando motivo, cantidad y filas disponibles sin repetir mensajes por fila.

#### Scenario: Listado con múltiples descartes
- **WHEN** el análisis devuelve filas descartadas
- **THEN** el indicador abre una segunda hoja con un grupo por motivo y permite volver a la revisión sin perder el mapeo

### Requirement: Vista previa con altura disponible
La tabla SHALL ocupar el alto disponible de la hoja, con scroll vertical y horizontal y encabezado fijo, conservando cabecera y acciones visibles a 1440 y 390 px.

#### Scenario: Archivo largo y ancho
- **WHEN** hay más filas y columnas que las visibles
- **THEN** se puede desplazar la tabla en ambos ejes sin perder el encabezado ni las acciones de importación
