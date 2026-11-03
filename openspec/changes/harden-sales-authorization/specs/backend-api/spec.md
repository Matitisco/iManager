## MODIFIED Requirements

### Requirement: Módulos REST por dominio
El backend SHALL exponer módulos independientes en rutas `/api/<módulo>/`: inventory, clients, sales, trade-ins, onboarding. Cada módulo implementa las operaciones CRUD necesarias para su dominio.

#### Scenario: Request a módulo con storeMember válido
- **WHEN** un usuario autenticado con storeMember OWNER o STAFF llama a un endpoint de módulo
- **THEN** el módulo procesa la operación y responde con los datos del store del usuario

#### Scenario: Referencias a otra tienda en Ventas
- **WHEN** un usuario proporciona IDs de ventas, canjes, clientes, productos, categorías, vendedores o pagos de otra tienda
- **THEN** el backend MUST impedir la lectura o modificación de esos registros y su vinculación a la tienda actual

#### Scenario: Anulación por edición de estado
- **WHEN** un miembro sin permiso sensible intenta asignar un estado de anulación mediante edición de venta
- **THEN** el backend MUST rechazar la operación sin persistir cambios
