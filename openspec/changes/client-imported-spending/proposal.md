# Histórico de compras de clientes

El importador actual solo conserva contactos; #576 calcula el gasto desde comprobantes. Preservar el histórico de Excel separado del acumulador mutable y comparar tres presentaciones en PRs draft.

## Non-goals
No cambiar ventas, deuda, garantías ni recuperar importes descartados por inferencia. Agregar dos campos nullable de Prisma, sin backfill automático.
