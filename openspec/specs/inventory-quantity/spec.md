# inventory-quantity Specification

## Purpose
TBD - created by archiving change add-inventory-quantity. Update Purpose after archive.
## Requirements
### Requirement: Cantidad persistida por ítem

Inventory MUST guardar una cantidad entera positiva por ítem con valor inicial 1, y MUST devolverla en listados completos y paginados.

#### Scenario: Registros y clientes API anteriores
- **WHEN** se agrega la columna a registros existentes o un alta omite cantidad
- **THEN** su cantidad es 1 y aparece así en la tabla

#### Scenario: Lectura luego de guardar
- **WHEN** se guarda un equipo con cantidad 4 y se vuelve a cargar el inventario
- **THEN** el listado completo y paginado muestran cantidad 4

### Requirement: Edición de cantidad en la interfaz

Inventario hi-fi MUST mostrar la columna Cantidad y permitir modificarla en el formulario de equipo. La interfaz MUST validar enteros positivos y cerrar como éxito únicamente tras persistir el dato.

#### Scenario: Alta y edición
- **WHEN** el usuario registra un equipo
- **THEN** el formulario inicia Cantidad en 1
- **AND** al guardar una cantidad válida, la tabla y el detalle muestran el valor guardado

#### Scenario: Valor inválido
- **WHEN** la cantidad está vacía, es cero, negativa, decimal o excede el entero de PostgreSQL
- **THEN** la operación se rechaza con error visible y el formulario permanece abierto

### Requirement: Actualizaciones parciales e importación

El API MUST conservar la cantidad cuando un PATCH o una reimportación no la especifican. La importación MUST aceptar una cantidad válida opcional y usar 1 para nuevas filas que la omitan.

#### Scenario: Cambio de otro campo
- **WHEN** se cambia el precio o estado de un equipo sin enviar cantidad
- **THEN** conserva la cantidad existente

#### Scenario: Importación con cantidad
- **WHEN** se importa un equipo con cantidad 3
- **THEN** el inventario guarda y devuelve cantidad 3

#### Scenario: Reimportación sin cantidad
- **WHEN** se reimporta un IMEI existente sin informar cantidad
- **THEN** se actualizan los demás datos y conserva su cantidad

