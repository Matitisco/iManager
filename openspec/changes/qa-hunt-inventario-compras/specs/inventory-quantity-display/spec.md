## ADDED Requirements

### Requirement: Cantidad visible consistente con stock persistido
Inventario MUST mostrar la cantidad persistida también para equipos con IMEI, sin permitir editar su cantidad.

#### Scenario: IMEI vendido sin unidades
- **WHEN** una venta deja un equipo con IMEI con cantidad cero
- **THEN** la celda de Cantidad muestra cero y no ofrece un input editable

### Requirement: Total activo excluye archivados
El denominador de Inventario activo MUST excluir equipos archivados, al igual que sus filas.

#### Scenario: Inventario con equipos archivados
- **WHEN** hay cinco unidades activas y diez archivadas
- **THEN** Todos muestra cinco de cinco y Archivados sigue permitiendo consultar sus registros
