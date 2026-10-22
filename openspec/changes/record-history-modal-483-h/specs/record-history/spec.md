## ADDED Requirements

### Requirement: Historial independiente en seguimientos
Los seguimientos de Stock, Ventas y Canjes MUST ofrecer un botón Historial y MUST presentar el historial en un segundo modal apilado, sin historial inline, ocultar historial ni filtro Todo.

#### Scenario: Abrir y cerrar historial
- **WHEN** se abre Historial y se cierra con Escape, botón o backdrop
- **THEN** el seguimiento y su borrador permanecen abiertos y el foco vuelve a Historial

### Requirement: Historial completo y estados de consulta
El modal MUST mostrar todos los eventos disponibles mediante cursores, con fecha/hora, persona y detalles, skeleton durante la carga y error visible con reintento.

#### Scenario: Más de una página
- **WHEN** la API devuelve un cursor
- **THEN** se consulta la siguiente página del mismo registro sin truncar el historial

#### Scenario: Carga o fallo
- **WHEN** la consulta está pendiente o falla
- **THEN** muestra skeleton sin texto visible de carga, o error y Reintentar, respectivamente

#### Scenario: Respuesta tardía
- **WHEN** se cierra el modal o cambia el registro o sesión antes de la respuesta
- **THEN** esa respuesta no aparece al volver a abrir otro historial
