## ADDED Requirements
### Requirement: Pantallas y permisos
El sistema SHALL mostrar Comisiones en Más y sidebar y permitir la administración solo con Comisiones; cada miembro sin ese permiso SHALL ver únicamente Mis comisiones.
#### Scenario: Empleado sin permiso
- **WHEN** abre Comisiones
- **THEN** consulta mine y no muestra costos, ganancia, pagos administrativos ni reglas editables.
### Requirement: Vendedor opcional
El sistema SHALL iniciar ventas sin vendedor y permitir elegirlo manualmente, editarlo y asignarlo en masa con permiso Comisiones.
#### Scenario: Venta sin vendedor
- **WHEN** se confirma sin seleccionar una persona
- **THEN** envía sellerMemberId null y exchangeRate de la cotización disponible.
### Requirement: Liquidación por moneda
El sistema SHALL mostrar saldos por moneda, pagos parciales y cruzados con cotización editable y ajustes negativos trasladados al siguiente mes.
#### Scenario: Pago en otra moneda
- **WHEN** se registra un pago USD que salda deuda ARS
- **THEN** muestra equivalencia y saldo restante y persiste moneda, cotización y moneda saldada.
### Requirement: Exportación de comisiones
El sistema SHALL exportar comisiones exclusivamente desde Reportes usando el endpoint de resumen por período y persona.
#### Scenario: Pantalla administrativa
- **WHEN** se abre Comisiones
- **THEN** no ofrece exportar, descargar ni copiar filas.
