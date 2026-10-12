## ADDED Requirements

### Requirement: Acciones visibles en el detalle de venta
El detalle de venta SHALL mantener sus acciones fuera del cuerpo desplazable, visibles sin scroll en desktop y mobile, respetando permisos, estado de venta, textos y comportamiento existentes.

#### Scenario: Venta con canje en desktop e iPhone
- **WHEN** se abre una venta con canje a 1440×900 o en un iPhone 13 de 390×844
- **THEN** Cerrar, Cancelar operación, Editar y Compartir comprobante están visibles y accesibles sin desplazar el contenido
- **THEN** el canje aparece agrupado en dos columnas, sin overflow horizontal, y el footer respeta el safe area inferior

#### Scenario: Contenido largo o venta pendiente
- **WHEN** el detalle requiere scroll o la venta está pendiente de cobro
- **THEN** solo el cuerpo se desplaza y las acciones correspondientes permanecen en el footer

#### Scenario: Todas las vistas y alturas de desktop
- **WHEN** se abre una venta larga con canje desde Ventas, Reportes, Dashboard o notificaciones a 1280×640, 1280×800, 1440×900 o en iPhone 13, incluida una venta iniciada desde la ficha del cliente
- **THEN** se usa el mismo detalle compacto con el canje dentro de su bloque titulado y todas las acciones visibles antes y después de desplazar el cuerpo

#### Scenario: Cantidad impar de acciones
- **WHEN** una venta tiene dos, tres o cuatro acciones
- **THEN** las acciones tienen columnas de igual ancho, márgenes y gaps uniformes, y la última acción impar ocupa toda la fila
