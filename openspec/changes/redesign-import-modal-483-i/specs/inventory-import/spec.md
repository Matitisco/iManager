## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir cargar CSV o XLSX y mapear sus columnas para importar múltiples productos. El importador compartido SHALL medir 600 px en desktop y presentarse como bottom sheet móvil con modos CSV, Subir .txt y Pegar listado, vista previa compacta y acción principal en el footer. TXT y listado de stock MUST conservar el analizador y validaciones existentes; los módulos sin analizador libre MUST reutilizar el parser CSV para texto con columnas.

#### Scenario: Importación exitosa
- **WHEN** el usuario sube un archivo, mapea las columnas y confirma
- **THEN** los productos se crean en el store y aparecen en la tabla

#### Scenario: Solo Modelo es requerido
- **WHEN** se importan filas donde solo Modelo tiene valor
- **THEN** los productos se crean con los campos opcionales vacíos o null

#### Scenario: Revisión con errores
- **WHEN** el análisis de texto detecta una fila inválida
- **THEN** la preview marca esa fila y conserva edición/exclusión y el bloqueo de confirmación existente

#### Scenario: Persistencia fallida
- **WHEN** falla el envío de las filas confirmadas
- **THEN** el modal conserva la preview y muestra el error sin cerrar como éxito

#### Scenario: Todos los consumidores
- **WHEN** se abre importar desde stock, proveedor, clientes, ventas u onboarding
- **THEN** se usa el mismo componente adaptable con acción accesible en el footer
