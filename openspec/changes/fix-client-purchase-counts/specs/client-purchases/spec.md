## ADDED Requirements

### Requirement: Contadores independientes de operaciones y unidades
Compras MUST contar cada operación activa una vez, aunque coincida modelo, producto o fecha; Garantías MUST sumar la cantidad de unidades con garantía vigente, incluyendo el día de vencimiento, excluyendo anuladas, vencidas, sin garantía y pendientes de entrega. Los históricos sin cantidad MUST aportar una unidad. La vista previa y los filtros MUST NOT alterar los indicadores globales ni multiplicar los importes por cantidad.

#### Scenario: Siete ventas del mismo producto y día
- **WHEN** existen siete ventas activas con IDs distintos del mismo producto y día, dos con cantidades 2 y 3 y las demás con cantidad 1, todas con cobertura vigente
- **THEN** Compras muestra 7 y Garantías muestra 10, aunque la vista previa renderice tres filas

#### Scenario: Cuatro operaciones con siete unidades
- **WHEN** cuatro ventas vigentes tienen cantidades 2, 3, 1 y 1
- **THEN** Compras muestra 4 y Garantías muestra 7

#### Scenario: Exclusiones y compatibilidad
- **WHEN** hay ventas anuladas, vencidas, sin cobertura, históricas sin cantidad y reparaciones pendientes/entregadas
- **THEN** solo las unidades con cobertura vigente suman garantías, cada histórico vigente aporta una unidad y los importes conservan su valor registrado
