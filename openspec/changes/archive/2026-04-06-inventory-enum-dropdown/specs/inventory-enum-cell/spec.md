## ADDED Requirements

### Requirement: Celda de tipo enum con dropdown inline
Las celdas de tabla cuyo campo es un enum con opciones fijas SHALL mostrar un `<select>` nativo al activarse en modo edición, en lugar de un `<input>` de texto. Las opciones disponibles SHALL ser las definidas en `ENUM_COL_OPTIONS` para esa columna. El sistema SHALL registrar `ENUM_COL_OPTIONS` como record central extensible para agregar futuros ColIds de tipo enum.

#### Scenario: Single-click activa el select en celda enum
- **WHEN** el usuario hace click en una celda de tipo enum (ej. Disponibilidad)
- **THEN** aparece un `<select>` con el valor actual pre-seleccionado y las opciones del enum disponibles

#### Scenario: Seleccionar opción guarda inmediatamente
- **WHEN** el usuario selecciona una opción distinta en el `<select>`
- **THEN** el valor se guarda via PATCH al backend sin necesidad de presionar Enter; la celda vuelve a modo display con el nuevo badge

#### Scenario: Escape cancela sin guardar
- **WHEN** el usuario presiona Escape mientras el `<select>` está activo
- **THEN** el select se cierra sin guardar; la celda muestra el valor anterior

#### Scenario: Blur sin cambio no guarda
- **WHEN** el usuario hace click fuera del `<select>` sin haber cambiado la opción
- **THEN** el select se cierra sin emitir PATCH al backend

### Requirement: Hitbox completa en celdas enum
Las celdas de tipo enum SHALL tener un área de hover y click equivalente a las celdas editables de texto — un `<div>` con `hover:bg-gray-200/70 transition-colors` que cubre el contenido de la celda, con cursor pointer.

#### Scenario: Hover sobre celda enum sin editar
- **WHEN** el usuario pasa el cursor sobre una celda de tipo enum
- **THEN** la celda muestra el fondo hover `bg-gray-200/70`, indicando que es interactuable

#### Scenario: Celda enum tiene data-col para hitbox de fila
- **WHEN** se hace doble-click o click en el área de la celda (incluso fuera del badge)
- **THEN** el sistema detecta la columna y activa el select para esa celda

### Requirement: Custom columns de tipo enum
El tipo `CustomColumn` SHALL soportar `type: 'enum'` con un campo `options: string[]` que define los valores válidos. Las celdas de custom columns de tipo enum SHALL renderizarse con el mismo `<select>` inline que las columnas fijas de tipo enum.

#### Scenario: Custom column de tipo enum en la tabla
- **WHEN** existe una custom column con `type: 'enum'` y `options: ['A', 'B', 'C']`
- **THEN** su celda muestra el valor actual como texto; al hacer click abre un `<select>` con las opciones definidas

#### Scenario: Guardar custom column enum
- **WHEN** el usuario selecciona una opción en el select de una custom column enum
- **THEN** el valor se guarda en `customFields[columnId]` via PATCH; la celda muestra el nuevo valor
