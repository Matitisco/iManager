## ADDED Requirements

### Requirement: Paginación server-side con filtros en PostgreSQL
El servidor SHALL resolver todos los filtros (condición, estado, capacidad, modelo, grado, batería, categoría) y el orden en PostgreSQL usando `$queryRaw`. El endpoint `GET /api/inventory?skip=N&take=30` SHALL devolver `{ items, total }`. Sin parámetros `skip`/`take`, el endpoint sigue devolviendo `{ inventory }` para backward-compatibility con AppContext.

#### Scenario: Fetch paginado con filtros
- **WHEN** el frontend llama `GET /api/inventory?skip=0&take=30&condition=USADO&sortKey=price&sortDir=asc`
- **THEN** el servidor devuelve los primeros 30 ítems que matchean `condition=USADO`, ordenados por precio ascendente, junto con el total de ítems que matchean

#### Scenario: Filtro de batería por valor mínimo
- **WHEN** el frontend envía `battery=80` como query param
- **THEN** el servidor filtra usando `CAST(SUBSTRING(batteryHealth FROM '^([0-9]+)') AS INTEGER) >= 80` en PostgreSQL, excluyendo ítems cuyo `batteryHealth` no comienza con dígito

#### Scenario: Backward-compatibility sin params
- **WHEN** AppContext llama `GET /api/inventory` sin parámetros `skip` ni `take`
- **THEN** el servidor devuelve `{ inventory: Product[] }` con todos los ítems (comportamiento legacy)

### Requirement: Endpoint de IDs filtrados para select-all global
El servidor SHALL exponer `GET /api/inventory/ids` que devuelve solo los IDs de ítems que matchean los filtros activos. Este endpoint SHALL ser usado cuando el usuario hace "seleccionar todo" para obtener los IDs de todos los ítems filtrados, incluyendo los no cargados aún en memoria.

#### Scenario: Select-all con paginación activa
- **WHEN** el usuario hace click en el checkbox de "seleccionar todo" y hay 162 ítems filtrados pero solo 30 cargados
- **THEN** el frontend llama `GET /api/inventory/ids` con los filtros actuales y selecciona los 162 IDs devueltos

#### Scenario: Select-all sin filtros
- **WHEN** el usuario hace click en "seleccionar todo" sin filtros activos
- **THEN** se devuelven los IDs de todos los ítems del store y todos quedan seleccionados
