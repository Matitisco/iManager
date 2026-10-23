## ADDED Requirements

### Requirement: Origen del equipo y filtro por proveedor
El sistema SHALL mostrar proveedor y fecha de compra bajo el modelo cuando existan y filtrar por supplierId junto con los demás filtros, conservando navegación, conteo y paginación. Equipos históricos sin origen SHALL omitir esos datos.

#### Scenario: Combinar filtros
- **WHEN** se selecciona un proveedor y una condición
- **THEN** solo se muestran los equipos que coinciden con ambos, desde la primera página, con su conteo actualizado.

### Requirement: Acceso al origen y problemas de compra
El sistema SHALL mostrar las filas Proveedor y Compra cuando existan, con enlaces a sus vistas compartidas. El aviso SHALL usar purchaseSummary del backend, aparecer solo con problems mayor que cero y reservar espacio sin desplazar el contenido al cargar. Fallos secundarios SHALL omitir datos sin error visible.

#### Scenario: Consultar problemas
- **WHEN** el backend informa N problemas y M equipos en la compra, con N mayor que cero
- **THEN** el equipo muestra «N de M equipos de esta compra tuvieron problemas» y permite abrir el detalle con permisos financieros existentes.

### Requirement: Proveedor del reclamo
El sistema SHALL mostrar una fila Proveedor en el reclamo cuando supplierName exista, sin sustitutos para datos ausentes.

#### Scenario: Reclamo con proveedor
- **WHEN** se abre un reclamo con supplierName
- **THEN** se muestra ese nombre como una fila adicional.
