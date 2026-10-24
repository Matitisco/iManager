## ADDED Requirements

### Requirement: Accessible archived supplier state
La lista de Proveedores SHALL identificar con texto «Archivado» cada proveedor archivado, además de conservar el tinte existente, en Todos y Archivados. Los proveedores activos MUST conservar su estado sin esa etiqueta.

#### Scenario: Archived record in the combined list
- **WHEN** el usuario consulta Todos y hay un proveedor archivado
- **THEN** la fila muestra «Archivado» y su nombre accesible incluye ese estado

#### Scenario: Archived filter
- **WHEN** el usuario consulta Archivados
- **THEN** cada fila conserva el acceso al detalle y muestra «Archivado»

#### Scenario: Active supplier
- **WHEN** la fila corresponde a un proveedor activo
- **THEN** no muestra la etiqueta «Archivado»

### Requirement: Filter-specific empty state
El filtro Activos vacío SHALL mostrar «No hay proveedores activos.», sin afirmar que nunca se cargaron proveedores. Todos vacío y Archivados vacío MUST conservar sus mensajes actuales.

#### Scenario: All suppliers are archived
- **WHEN** existe un proveedor archivado y el usuario consulta Activos
- **THEN** se muestra «No hay proveedores activos.»

#### Scenario: First supplier experience
- **WHEN** Todos no tiene registros
- **THEN** se conserva «Todavía no cargaste proveedores.»

#### Scenario: No archived suppliers
- **WHEN** Archivados no tiene registros
- **THEN** se conserva «No hay proveedores archivados.»

### Requirement: Mobile supplier form text size
Los inputs y Notas de alta/edición de Proveedores SHALL usar 16 px en móvil, conservando alturas y controles existentes.

#### Scenario: Mobile supplier form
- **WHEN** el viewport tiene como máximo 760 px de ancho
- **THEN** los campos editables del formulario muestran texto de 16 px
