# Diseño

Requests Fastify contra PostgreSQL local exclusivo; tests de regresión antes del fix y concurrencia con Promise.all. Validación monetaria limitada a la representación Decimal(12,2), estados conocidos y claves existentes. Reutilizar transacciones serializables y requestKey existentes sin migraciones. Caja y cuenta corriente deben registrar el mismo importe efectivo cuando se omite excedente.
