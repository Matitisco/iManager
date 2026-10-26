## Context
#551 reemplazó el cierre móvil del historial por Volver; #567 renombró Cerrar a Cancelar en OperationForm; #572 cambió las filas de comisiones; #574 convirtió el modal de reporte automático en navegación a Envío por mail.

## Decisions
Usar los controles accesibles vigentes y verificar que los diálogos se cierran. En comisiones, localizar la venta dentro del panel Ventas y conservar el importe esperado de 150,03. En reporte, verificar ruta, pestaña activa y destinatarios editables. Mantener la rama de cierre de escritorio del helper compartido.

## Validation
Reproducir los E2E afectados sin modificar; repetir luego de actualizar contratos, incluyendo las cuatro variantes de vendedor y su flujo compartido de escritorio. TypeScript frontend/backend; checks del PR y CI completo del commit mergeado.
