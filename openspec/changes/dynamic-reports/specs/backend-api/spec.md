## MODIFIED Requirements

### Requirement: Modulos REST por dominio
El backend SHALL exponer modulos independientes en rutas `/api/<modulo>/`: inventory, clients, sales, trade-ins, reports, onboarding. Cada modulo implementa las operaciones CRUD o de agregacion necesarias para su dominio.

#### Scenario: Request a modulo con storeMember valido
- **WHEN** un usuario autenticado con storeMember OWNER o STAFF llama a un endpoint de modulo
- **THEN** el modulo procesa la operacion y responde con los datos del store del usuario

#### Scenario: Reports overview accepts custom ranges
- **WHEN** un usuario autenticado llama a `GET /api/reports/overview` con `rangeKey=custom` y fechas validas
- **THEN** el backend responde `200` con el overview agregado para ese rango

#### Scenario: Reports overview rejects invalid custom ranges
- **WHEN** un usuario autenticado llama a `GET /api/reports/overview` con `rangeKey=custom` sin ambas fechas o con `startDate` posterior a `endDate`
- **THEN** el backend responde `400` con un error visible y no procesa el overview
