## ADDED Requirements

### Requirement: Separación del bloque Equipo
Configuración SHALL separar el bloque Equipo de Tienda y Mi cuenta con 24px de margen vertical y dejar 12px entre su encabezado y la tarjeta de miembros.

#### Scenario: Escritorio y teléfono
- **WHEN** se abre Configuración con acceso a Equipo
- **THEN** el bloque tiene la separación indicada sin alterar las filas ni desbordar horizontalmente

#### Scenario: Vista independiente
- **WHEN** se abre la pantalla independiente de Equipo
- **THEN** conserva sus márgenes existentes
