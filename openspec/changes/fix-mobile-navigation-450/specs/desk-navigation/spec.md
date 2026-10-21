## ADDED Requirements

### Requirement: Posición por entrada de navegación
El sistema SHALL abrir módulos nuevos desde el inicio del contenedor real y restaurar contexto al recorrer el historial.

#### Scenario: Más desplazado abre Reportes
- **WHEN** se abre Reportes desde el final de Más
- **THEN** su cabecera y filtros aparecen al inicio
- **AND** Atrás devuelve la posición anterior de Más

#### Scenario: Edición y búsqueda no provocan saltos
- **WHEN** se escribe, llegan datos o se abre/cierra un modal en una lista
- **THEN** no se reinicia su scroll, foco ni borrador
- **AND** al volver por historial se restauran búsqueda, filtros y página

### Requirement: Contadores comprensibles
El sistema SHALL explicar los componentes de cada badge sin cambiar el conteo ni exponer secciones no permitidas.

#### Scenario: Grupo Comercial incluye Canjes
- **WHEN** hay avisos de ventas y canjes en curso
- **THEN** el badge de Ventas mantiene la suma del grupo
- **AND** su descripción accesible y la explicación visible distinguen ambos conceptos

### Requirement: Espacio móvil utilizable
El sistema SHALL agrupar acciones secundarias y mantener accesibles última fila, paginación, acción principal y navegación a 320 y 390 px.

#### Scenario: Selección masiva
- **WHEN** se activa selección con cero o varios registros
- **THEN** la barra masiva reemplaza el dock principal y reserva su altura real sobre la navegación
- **AND** se puede recorrer hasta la paginación sin elementos ocultos
