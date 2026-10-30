## Decisions
- Extraer resolución de tienda y cálculo compartidos; GET conserva su contrato READ ONLY.
- Apply usa Serializable, bloqueo FOR UPDATE OF i, lock_timeout y validación completa previa a escrituras.
- Backup de todas las columnas físicas de las filas afectadas en la respuesta, sin persistencia adicional ni logs.
- Restaurar con jsonb_populate_record y columnas de information_schema, protegiendo pertenencia a la tienda y auditorías ajenas.
- Verificar conteos y unidades antes de commit; cualquier diferencia revierte la transacción.

## Validation
TypeScript backend y ambos archivos de integración de duplicados en PostgreSQL local exclusivo. Snapshots de todas las tablas para rechazos; round trip e idempotencia.
