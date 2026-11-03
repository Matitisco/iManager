# Conservar centavos USD en pantalla (#745)

Ventas y Dashboard muestran importes USD redondeados a entero aunque la venta conserva centavos. Reutilizar el formateador monetario compartido para mostrar dos decimales cuando el importe USD tenga fracción y ninguno para enteros; el detalle debe seguir el mismo criterio.

## Non-goals

Sin cambios de Prisma, persistencia, cálculos de totales/ganancias, permisos (#691), formato ARS ni acceso a producción. Entrega por PR a `test`.
