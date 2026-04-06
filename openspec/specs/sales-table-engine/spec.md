# sales-table-engine Specification

## Purpose
TBD - created by archiving change sales-table-engine-parity. Update Purpose after archive.
## Requirements
### Requirement: Sales usa TableEngine como template reusable
El sistema SHALL renderizar la sección de Ventas sobre `TableEngine` en lugar de una tabla artesanal, preservando la separación entre contrato reusable y workflows de dominio de la página.

#### Scenario: Render inicial
- **WHEN** el usuario abre la página de Ventas
- **THEN** la grilla de ventas se renderiza a través de `TableEngine` con columnas, filtros y acciones de dominio configuradas por la página

#### Scenario: Filtros siguen siendo de página
- **WHEN** el usuario cambia un filtro de Ventas
- **THEN** la página recalcula la vista de datos y el engine vuelve a renderizar sobre el subconjunto filtrado

### Requirement: Ventas conserva la interacción de tabla equivalente a Inventario
El sistema SHALL ofrecer en Ventas selección de filas, sort, paginación, navegación por teclado, edición inline, menú contextual y bulk actions con el mismo contrato de interacción que Inventario, salvo workflows específicos de categorías o drag-and-drop que no aplican al dominio de Ventas.

#### Scenario: Selección con rango
- **WHEN** el usuario selecciona una fila y luego usa shift-select sobre otra fila visible
- **THEN** el rango intermedio queda seleccionado

#### Scenario: Escape limpia la selección
- **WHEN** el usuario presiona Escape con una selección activa
- **THEN** la selección se limpia

#### Scenario: Edición inline
- **WHEN** el usuario abre una celda editable en una fila de Ventas
- **THEN** la celda entra en modo edición inline y persiste el cambio por el flujo de actualización existente

#### Scenario: Menú contextual y bulk actions
- **WHEN** el usuario abre el menú contextual sobre una fila o una selección múltiple
- **THEN** el engine expone acciones de editar, eliminar y eliminar en bulk según corresponda

### Requirement: Preferencias de columnas persistidas para Ventas
El sistema SHALL persistir en Ventas el orden, la visibilidad y los labels personalizados de columnas con el mismo contrato de preferencias del engine.

#### Scenario: Recarga conserva preferencias
- **WHEN** el usuario oculta, reordena o renombra columnas en Ventas y luego recarga la pantalla
- **THEN** las preferencias vuelven a aplicarse al volver a montar el template

### Requirement: Exportación de Ventas respeta la vista activa
El sistema SHALL permitir exportar Ventas respetando las columnas visibles y los labels personalizados del view actual.

#### Scenario: Export con columnas ocultas
- **WHEN** el usuario exporta Ventas con columnas ocultas
- **THEN** el archivo exportado omite esas columnas

#### Scenario: Export con labels renombrados
- **WHEN** el usuario exporta Ventas después de renombrar una columna
- **THEN** el encabezado exportado usa el label renombrado

### Requirement: Panel de edición de Ventas permanece fuera del engine
El sistema SHALL mantener el panel lateral de edición de una venta como workflow de página y no como responsabilidad del core de `TableEngine`.

#### Scenario: Editar desde acción de fila
- **WHEN** el usuario elige editar una venta desde el menú contextual
- **THEN** se abre el panel lateral de edición existente para esa venta

#### Scenario: Guardado sin cerrar prematuramente
- **WHEN** el usuario confirma cambios en el panel lateral y la persistencia todavía no resolvió
- **THEN** el panel no se cierra hasta que la actualización termina con éxito

