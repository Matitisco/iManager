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

### Requirement: Proveedor inline y alternativas visuales
El sistema SHALL permitir crear un proveedor desde el selector del formulario de equipo y seleccionarlo después de confirmar la persistencia. Las variantes A/B SHALL compartir el comportamiento de negocio y seleccionarse mediante importVariant.

#### Scenario: Creación exitosa
- **WHEN** se completa el nombre y la API confirma el proveedor
- **THEN** el formulario conserva sus campos y selecciona el proveedor creado

#### Scenario: Error de persistencia
- **WHEN** la API rechaza la creación del proveedor
- **THEN** se conserva el nombre, se muestra el error y no se selecciona ni cierra como éxito
