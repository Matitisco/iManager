## ADDED Requirements

### Requirement: Margen con costos conocidos
El overview MUST excluir ventas sin equipo o con costo nulo o cero del margen y su porcentaje, conservar facturación/unidades y mostrar cuántas ventas excluye.

#### Scenario: Ventas con y sin costo
- **WHEN** una venta de 100 tiene costo 60 y otra de 200 no tiene costo
- **THEN** el margen es 40, el porcentaje 40%, la facturación 300 y la nota indica una venta excluida

### Requirement: Todos sin archivados
Inventario MUST excluir archivados en Todos tanto en móvil como en escritorio y conservar el acceso explícito a Archivados.

#### Scenario: Filtro Todos
- **WHEN** se abre Todos con equipos activos y archivados
- **THEN** solo aparecen activos

### Requirement: Anulación única
La UI MUST impedir ofrecer una nueva anulación sobre una venta anulada por fecha o estado.

#### Scenario: Menú o detalle de venta anulada
- **WHEN** se abre una venta anulada
- **THEN** Anular no está disponible
