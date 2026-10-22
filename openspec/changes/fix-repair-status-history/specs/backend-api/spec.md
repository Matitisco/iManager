## ADDED Requirements

### Requirement: Historial completo de una reparación
El sistema MUST devolver auditoría y eventos de estado sin auditoría equivalente al consultar el historial de una reparación, con aislamiento por tienda, filtros y paginación estables.

#### Scenario: Estados antiguos y actuales
- **WHEN** se consulta una orden con ingreso, cambios de estado y entrega
- **THEN** cada movimiento aparece una vez, preservando fecha y autor conocido y sin inventar autores anteriores

### Requirement: Acceso único al historial
El sistema MUST mostrar el historial de reparación únicamente en el segundo modal abierto por Historial, con estados legibles en español.

#### Scenario: Detalle móvil y escritorio
- **WHEN** se abre cualquiera de las dos vistas de detalle
- **THEN** no existe línea de tiempo inline y el botón Historial consulta la reparación y muestra sus movimientos
