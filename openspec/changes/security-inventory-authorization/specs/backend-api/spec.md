## ADDED Requirements

### Requirement: Autorización de moneda de inventario
El backend MUST aplicar el permiso sensible de edición financiera a cambios de moneda de equipos existentes, conservando lectura financiera STAFF y edición no financiera.

#### Scenario: Miembro sin permiso sensible cambia moneda
- **WHEN** un miembro sin permiso sensible envía una moneda distinta a la moneda efectiva del equipo por PATCH
- **THEN** recibe 403 sin cambios persistidos ni auditoría de éxito

#### Scenario: Miembro autorizado o moneda sin cambios
- **WHEN** un miembro autorizado cambia moneda o un miembro sin permiso sensible conserva la moneda efectiva
- **THEN** se mantienen los flujos legítimos existentes

### Requirement: Aislamiento de inventario y compras
El backend MUST aislar equipos, categorías, campos personalizados, proveedores, compras y conteos por la tienda autenticada, incluso con IDs ajenos o arrays mixtos.

#### Scenario: Identificadores de otra tienda
- **WHEN** una solicitud incluye IDs, IMEI o storeId de otra tienda
- **THEN** no expone ni modifica registros ajenos ni permite relaciones entre tiendas
