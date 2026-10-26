## ADDED Requirements

### Requirement: Precio a definir
El sistema SHALL importar filas con modelo sin precio como null y mostrar «A definir».

#### Scenario: Archivo sin precio
- **WHEN** se importa un archivo con modelo y costo sin precio de venta
- **THEN** se conservan los equipos y el resultado permite filtrarlos por precio a definir

#### Scenario: Reimportación
- **WHEN** un archivo omite el precio de un IMEI existente
- **THEN** se conserva el precio guardado

#### Scenario: Venta sin precio
- **WHEN** se intenta vender un equipo con precio null sin importe positivo
- **THEN** se exige completar el precio antes de persistir la venta

### Requirement: Correcciones desde la importación
El sistema SHALL destacar campos obligatorios sin mapear y ofrecer acceso directo al mapeo faltante.

#### Scenario: Modelo sin mapear
- **WHEN** falta mapear Modelo
- **THEN** se resalta el campo y se bloquea la confirmación

### Requirement: Proveedor inline
El sistema SHALL permitir crear un proveedor desde el selector del formulario de equipo y seleccionarlo después de confirmar la persistencia. El editor SHALL permanecer dentro del formulario de equipo.

#### Scenario: Creación exitosa
- **WHEN** se completa el nombre y la API confirma el proveedor
- **THEN** el formulario conserva sus campos y selecciona el proveedor creado

#### Scenario: Error de persistencia
- **WHEN** la API rechaza la creación del proveedor
- **THEN** se conserva el nombre, se muestra el error y no se selecciona ni cierra como éxito

### Requirement: Diagnósticos compatibles con precio a definir
El sistema SHALL conservar los diagnósticos por motivo y los eventos de importación, tratar Precio como recomendado y usar los campos de diagnóstico en la vista previa y el resultado.

#### Scenario: Archivo sin precio y con filas descartadas por otros motivos
- **WHEN** el archivo incluye equipos reconocibles sin precio y filas sin modelo o con precio inválido
- **THEN** los equipos reconocibles se conservan con precio null, los otros descartes se cuentan por su motivo real y no se registra missing_price
- **AND** la vista previa y el resultado muestran los motivos, los obligatorios faltantes y el resultado con precio a definir sin exponer contenido de celdas en los eventos
