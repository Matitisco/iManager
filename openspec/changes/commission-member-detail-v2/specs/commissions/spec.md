## ADDED Requirements
### Requirement: Detalle compacto del vendedor
El sistema SHALL mostrar los saldos reales del vendedor en una grilla 2×2 y destacar pendiente en amarillo suave, conservando monedas, ajustes, permisos y acciones existentes.
#### Scenario: Vendedor con saldo
- **WHEN** se abre su detalle administrativo
- **THEN** se ve su nombre, período, rol, regla y saldos sin subtítulo, con Cambiar regla y Registrar pago o Listo.
### Requirement: Listados del detalle
El sistema SHALL separar Ventas y Pagos en pestañas con tres registros iniciales y «Ver todas (N)» para listas mayores, sin modificar Mis comisiones.
#### Scenario: Lista extensa
- **WHEN** se activa Ver todas
- **THEN** se abre una segunda hoja con todos los registros, a pantalla completa con Volver en móvil.
### Requirement: Anulados integrales
El sistema SHALL mostrar ventas y pagos anulados con fondo rojo suave sobre toda la tarjeta redondeada, importe tachado, píldora Anulado y sin acciones.
#### Scenario: Anulación de pago
- **WHEN** se confirma anular un pago activo desde cualquier listado
- **THEN** se usa la acción existente, con máximo dos hojas y errores visibles sin cerrar como éxito.
