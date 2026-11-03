# Diseño

Script independiente del servidor y de Firebase. Lock advisory de sesión con cliente Prisma exclusivo de una conexión; cada lote usa transacción corta, lock timeout y statement timeout. SQL parametrizado con allowlists cerradas; no se aceptan tablas/acciones desde env.

Auditoría de accesos conocida: 730 días mínimos. Telemetría efímera sin dedupeKey: 90 días mínimos. Notificaciones: creación y todas las lecturas anteriores a 90 días, al menos una lectura y todos los miembros activos con lectura. Todo otro registro se conserva, incluidos auditoría financiera y eventos de producto con clave de deduplicación.

Opt-in RETENTION_JOBS_ENABLED, RETENTION_DRY_RUN=true por defecto en todos los entornos. CLI omitida en test. El dry-run pagina candidatos sin borrar y reporta una muestra acotada, no un total de la DB. Logs solo de configuración segura, estado y conteos; errores genéricos sin mensajes de Prisma.
