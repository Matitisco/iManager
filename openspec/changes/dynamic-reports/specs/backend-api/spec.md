## MODIFIED Requirements

### Requirement: Módulos REST por dominio
El backend SHALL exponer mÃ³dulos independientes en rutas `/api/<mÃ³dulo>/`: inventory, clients, sales, trade-ins, reports, onboarding. Cada mÃ³dulo implementa las operaciones CRUD o de agregaciÃ³n necesarias para su dominio.

#### Scenario: Request a mÃ³dulo con storeMember vÃ¡lido
- **WHEN** un usuario autenticado con storeMember OWNER o STAFF llama a un endpoint de mÃ³dulo
- **THEN** el mÃ³dulo procesa la operaciÃ³n y responde con los datos del store del usuario
