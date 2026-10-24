## ADDED Requirements

### Requirement: Lectura fiel de archivos CSV
El sistema SHALL conservar cada columna de CSV delimitado por coma, punto y coma o tabulación, respetando campos entre comillas, comillas escapadas y saltos de línea internos.

#### Scenario: Importes y nombres argentinos
- **WHEN** se sube un CSV con precio "1.250,50" y nombre "Pérez, José"
- **THEN** ambos valores conservan su columna en el mapeo y la vista previa.

### Requirement: Moneda de inventario
El sistema SHALL conservar la moneda explícita de cada equipo sin convertir el importe silenciosamente.

#### Scenario: Planilla mixta
- **WHEN** una fila tiene precio 420 y moneda USD en una tienda ARS
- **THEN** preview y persistencia conservan 420 USD.

### Requirement: Repetición de ventas importadas
El sistema SHALL impedir que una fila de venta normalizada idéntica ya importada genere otra venta o modifique saldos/stock nuevamente.

#### Scenario: Reintento del mismo archivo
- **WHEN** se vuelve a confirmar un archivo de ventas importado con la corrección vigente
- **THEN** las filas repetidas muestran un error claro y el conteo de ventas no aumenta.

### Requirement: Errores de filas visibles
El sistema SHALL conservar las ventas reconocibles con precio inválido para revisión y SHALL distinguir resultados con filas rechazadas del éxito total.

#### Scenario: Venta con importe inválido
- **WHEN** una fila tiene equipo y cliente pero el importe no es numérico
- **THEN** la vista previa la señala y la confirmación informa el error sin crear la venta.

### Requirement: Altura estable durante lectura
El sistema SHALL reservar la altura anterior del contenido del modal mientras se analiza un archivo para evitar que se contraiga durante una lectura breve.

#### Scenario: Análisis rápido
- **WHEN** el archivo se analiza antes de mostrar el skeleton
- **THEN** el modal conserva la altura previa hasta presentar el resultado.
