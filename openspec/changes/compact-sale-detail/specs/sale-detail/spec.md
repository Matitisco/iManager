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
