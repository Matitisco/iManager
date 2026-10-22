## ADDED Requirements

### Requirement: Historial legible para auditoría
El sistema SHALL separar persona, acción, registro y hora, apilados en móvil, y agrupar movimientos por día descendente con fecha completa.
#### Scenario: Listado paginado
- **WHEN** se consulta el historial
- **THEN** inicia con 30 días, muestra conteos de movimientos visibles por día y permite Cargar más con los filtros actuales.

### Requirement: Filtros explícitos
El sistema SHALL conservar búsqueda y filtros Persona, Período, Acción y Sección con su valor visible.
#### Scenario: Seleccionar acción
- **WHEN** se elige Edición
- **THEN** el selector Acción muestra Edición y la consulta usa ese grupo.

### Requirement: Detalle fiel a datos registrados
El sistema SHALL mostrar registro, persona, rol y fecha/hora en modal desktop y hoja mobile; SHALL mostrar Antes/Después únicamente desde changes, motivo solo si existe y destino solo si existe y está autorizado.
#### Scenario: Evento sin cambios estructurados
- **WHEN** solo existe detail
- **THEN** se muestra como texto sin tabla Antes/Después ni valores inferidos.
#### Scenario: Equipo identificado
- **WHEN** el equipo existe en la tienda
- **THEN** el historial incluye su IMEI completo y la búsqueda lo encuentra sin mezclar tiendas.
