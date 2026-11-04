## ADDED Requirements

### Requirement: Equipos propios en consignación
El sistema SHALL permitir entregar equipos disponibles a cualquier cliente activo de la tienda, con precio acordado por unidad y moneda. SHALL conservar cantidad y propiedad hasta el cobro y bloquear ventas, reservas y nuevas consignaciones del mismo equipo.

#### Scenario: Crear y consultar pendientes
- **WHEN** se entregan equipos disponibles a clientes existentes
- **THEN** siguen en inventario marcados En consignación y se muestran por persona con deuda, fecha, días afuera y totales por moneda, unidades y personas.

### Requirement: Cobro total atómico
El sistema SHALL registrar solo cobros completos, creando una venta mediante sales.service y cerrando la consignación en la misma transacción.

#### Scenario: Marcar pagada
- **WHEN** se cobra una consignación pendiente
- **THEN** se crea una única venta completada y su cobro, se descuenta stock y desaparece de los pendientes; un segundo cobro o acceso desde otra tienda es rechazado.

### Requirement: Comercial y temas
El sistema SHALL mostrar Consignaciones en Comercial con los permisos de Ventas y ofrecer alta con cliente, equipos y precios en claro y oscuro.

#### Scenario: Navegar y operar
- **WHEN** un miembro autorizado entra a Consignaciones
- **THEN** ve tarjetas por persona, búsqueda, totales, alta y cobro con errores visibles, sin cerrar formularios fallidos.
