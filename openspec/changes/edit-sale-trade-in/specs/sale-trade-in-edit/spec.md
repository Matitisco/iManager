## ADDED Requirements

### Requirement: Editar el canje de una venta
El sistema SHALL permitir agregar, quitar y editar un canje en una venta existente desde desktop y mobile.

#### Scenario: Agregar canje
- **WHEN** se edita una venta sin canje y se activa Tiene canje con datos válidos
- **THEN** se conserva la venta y se crea un canje confirmado con su estado técnico Pendiente, el recibido en revisión en inventario y diferencia actualizada

#### Scenario: Quitar canje
- **WHEN** se desactiva Tiene canje al editar una venta
- **THEN** la venta sigue activa sin canje, el canje queda cancelado en el historial, el recibido se archiva y la deuda se recalcula

#### Scenario: Cambiar datos del canje
- **WHEN** se cambian equipo recibido o valor tomado
- **THEN** se actualizan el canje, su recibido y la diferencia sin duplicar la venta

#### Scenario: Persistencia fallida
- **WHEN** el recibido ya se vendió o el IMEI nuevo está duplicado
- **THEN** se rechaza la edición sin cambios parciales y el formulario conserva sus datos con un error visible

### Requirement: Presentación del canje editado
El sistema SHALL mostrar los estados, mensajes y avisos coherentes con la operación persistida en desktop y mobile.

#### Scenario: Cancelado en historial y filtro
- **WHEN** existe un canje con estado CANCELADO
- **THEN** badge y filtro muestran Cancelado con ícono y color semántico; los filtros mobile permanecen en una fila desplazable

#### Scenario: Canje quitado de una venta
- **WHEN** se quita un canje de una venta activa y se recarga el historial
- **THEN** la fila indica Canje quitado de la venta V-XXXX conservando el número de la venta; otras cancelaciones indican Canje cancelado

#### Scenario: Aviso al guardar canje
- **WHEN** se guarda una operación con canje
- **THEN** el aviso muestra el estado técnico real del canje, incluido Pendiente para un canje nuevo

### Requirement: Cobertura de los modales mobile de venta
El sistema SHALL cubrir la navegación inferior y la lista de fondo con los modales de detalle y edición de venta.

#### Scenario: Abrir detalle o edición en mobile
- **WHEN** se abre el detalle o la edición de una venta en un viewport mobile
- **THEN** el overlay ocupa todo el viewport y el sheet llega al borde inferior con acciones accesibles, respetando safe area y scroll interno
