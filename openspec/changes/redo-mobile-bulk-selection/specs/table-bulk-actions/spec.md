## ADDED Requirements

### Requirement: Selección móvil explícita
El sistema SHALL mostrar Seleccionar arriba de Inventario, Ventas, Canjes y Clientes sin checkboxes en modo normal. El toque largo SHALL abrir Editar/Eliminar sin seleccionar; Seleccionar varios SHALL activar el modo con esa fila seleccionada. Desktop SHALL conservar checkboxes y selección por rango.

#### Scenario: Entrar y salir de selección
- **WHEN** el usuario activa Seleccionar o Seleccionar varios
- **THEN** aparecen checkboxes, Seleccionar todos y una barra con N seleccionados, acción sensible confirmada y Listo, incluso con cero seleccionados; Listo limpia y sale.

### Requirement: Exportación exclusiva de Reportes
El sistema SHALL retirar exportaciones de filas de tablas, CSV masivo y copia de Lista de precios conservando exportación de Reportes.

#### Scenario: Acciones disponibles
- **WHEN** se abre una lista o se seleccionan filas
- **THEN** no hay acciones de exportación; permisos y auditoría de acciones destructivas se conservan.

### Requirement: Activación inmediata del worker
El worker SHALL invocar skipWaiting al comenzar install sin depender del precache.

#### Scenario: Varias pestañas y cache pendiente
- **WHEN** se instala una versión nueva con pestañas abiertas y precache pendiente
- **THEN** skipWaiting ya fue solicitado y tras instalar el worker activa sin waiting.
