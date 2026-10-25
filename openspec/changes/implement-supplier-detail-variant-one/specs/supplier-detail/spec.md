## ADDED Requirements

### Requirement: Detalle de proveedor con inversión primero
El modal SHALL presentar la variante 1 aprobada usando datos reales y los permisos existentes.

#### Scenario: Proveedor con compras
- **WHEN** se abre un proveedor con compras y permiso financiero
- **THEN** muestra inversión separada por moneda, reloj de historial junto al importe, stock, contacto, notas, problemas y hasta tres compras con acceso al listado completo

#### Scenario: Sin compras o sin permiso financiero
- **WHEN** faltan compras o permiso financiero
- **THEN** omite la inversión y conserva historial autorizado en encabezado, contacto faltante como Sin cargar y vacío de compras en una fila

#### Scenario: Historial y viewport
- **WHEN** se abre historial desde el reloj a 1440 o 390
- **THEN** mantiene la segunda hoja existente y el retorno de foco, sin eventos en línea; encabezado y pie del detalle permanecen dentro del viewport con scroll interno
