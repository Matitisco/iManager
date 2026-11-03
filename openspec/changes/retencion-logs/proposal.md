# Retención segura de logs

## Why
Auditoría, notificaciones y telemetría crecen sin purga. El historial admin combina AuditEvent, ProductEvent y PostHog; algunos registros tienen dependencias operativas.

## What Changes
Agregar un script backend para cron con configuración explícita, dry-run predeterminado, lock PostgreSQL y lotes acotados. Documentar inventario, política, operación y aprobación pendiente.

## Non-goals
Sin schema, migraciones, purga financiera, cambios frontend, proveedores externos ni acceso a producción.
