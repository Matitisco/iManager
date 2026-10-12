# Editar el canje de una venta

Resolver #146: permitir agregar, quitar y modificar el canje de una venta existente con el mismo formulario de creación, en desktop y mobile. La persistencia debe mantener inventario, historial y saldos coherentes. No requiere cambios de Prisma.

Seguimiento #288: normalizar Cancelado con ícono y color, distinguir quitar el canje de cancelar la operación, mostrar el estado técnico real en el aviso y cubrir la navegación inferior con los modales mobile. Se agrega únicamente un campo nullable de historial para conservar el número de la venta al desvincular el canje.
