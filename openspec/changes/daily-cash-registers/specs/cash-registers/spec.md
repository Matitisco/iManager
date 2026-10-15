## ADDED Requirements

### Requirement: Cajas y movimientos por moneda y medio
El sistema SHALL mantener cajas ARS/USD y Efectivo/Transferencia independientes, permitir ajustes sin resultados y archivar conservando saldo. Ingreso/egreso y conversión SHALL ser atómicos y auditados; egreso requiere categoría, conversión guarda cotización y dos patas.
#### Scenario: Conversión
- **WHEN** se convierten USD a ARS con una cotización revisada
- **THEN** las dos cajas registran importes originales y la misma cotización sin ganancia/gasto.
#### Scenario: Anulación
- **WHEN** se anula un movimiento manual
- **THEN** un contramovimiento único restaura el dinero y conserva el original; una conversión revierte ambas patas.

### Requirement: Cobros integrados
El sistema SHALL registrar cobros de ventas, cuotas, señas y reparaciones en su moneda/medio original en la misma transacción del negocio; aplicar una seña no vuelve a cobrarla.
#### Scenario: Sesión cerrada
- **WHEN** hay cajas configuradas y se intenta cobrar sin una sesión compatible abierta de hoy
- **THEN** falla visiblemente y no cambia venta, stock, saldo ni caja.
#### Scenario: Venta mixta anulada
- **WHEN** se anula una venta con cobros vinculados en distintas monedas/medios
- **THEN** cada cobro se compensa una vez en su caja original.

### Requirement: Cierre ciego y aprobación
El sistema SHALL calcular Esperado = fondo + movimientos, Diferencia = contado - esperado, guardar denominaciones y cada intento, exigir nota ante diferencia, y exigir aprobación OWNER antes de otro día.
#### Scenario: Conteo y reconteo
- **WHEN** se abre el conteo o se pide reconteo
- **THEN** no se muestra esperado hasta guardar; movimientos quedan bloqueados mientras se revisa, y todos los intentos se conservan.

### Requirement: Permiso separado de saldos
El sistema SHALL permitir cobrar con acceso Cajas sin exponer saldo/historial a quien no tenga cashBalances, y aislar toda operación por tienda.
#### Scenario: Empleado sin saldo
- **WHEN** consulta cajas un empleado sin cashBalances
- **THEN** recibe nombres y sesión operable sin saldos ni historial y no puede aprobar, ajustar o administrar cajas.
