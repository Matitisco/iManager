## ADDED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir al usuario cargar un archivo CSV o XLSX y mapear sus columnas a los campos del inventario para importar múltiples productos en un solo paso.

#### Scenario: Importación exitosa
- **WHEN** el usuario sube un archivo, mapea las columnas y confirma la importación
- **THEN** los productos se crean en el inventario del store y aparecen en la tabla

#### Scenario: Solo Modelo es requerido
- **WHEN** el usuario importa filas donde solo el campo Modelo tiene valor
- **THEN** los productos se crean con los campos opcionales vacíos o en null; no se rechaza el import

### Requirement: Selector de hoja para Excel multi-hoja
El sistema SHALL mostrar un selector de hoja cuando el archivo XLSX contiene más de una hoja, permitiendo al usuario elegir cuál importar.

#### Scenario: Archivo con múltiples hojas
- **WHEN** el usuario sube un XLSX con 3 hojas
- **THEN** el modal muestra un dropdown con los nombres de las hojas; el usuario selecciona una antes de continuar

### Requirement: Columnas no mapeadas se agregan como columnas custom
El sistema SHALL ofrecer la opción de crear columnas custom en el inventario para las columnas del archivo que no tienen mapeo a un campo del sistema.

#### Scenario: Columna sin mapeo confirmada como custom
- **WHEN** el usuario no mapea una columna del archivo y confirma agregarla como custom
- **THEN** se crea una nueva columna custom en el inventario y se importa el valor de cada fila

### Requirement: Normalización de valores de batería
El sistema SHALL normalizar valores de batería en formato decimal a porcentaje durante el import. Valores como `0.84` MUST convertirse a `"84%"` y `1` a `"100%"`. Rangos como `"83-85%"` se preservan como string.

#### Scenario: Batería en formato decimal
- **WHEN** el archivo contiene el valor `0.84` en la columna de batería
- **THEN** el producto se importa con `batteryHealth: "84%"`

#### Scenario: Batería en formato de rango
- **WHEN** el archivo contiene el valor `"83-85%"` en la columna de batería
- **THEN** el producto se importa con `batteryHealth: "83-85%"` sin modificar
