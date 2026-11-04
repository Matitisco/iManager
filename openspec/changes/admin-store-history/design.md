# Diseño

Catálogo permitido de acciones persistidas en los nueve dominios pedidos; tipos por operación: create, delete, update, connection. Excluir otros módulos, navegación, instalaciones, abandonos, fallos e hitos duplicados. Proyectar solo claves de campos de AuditEvent.changes y traducirlas con catálogo seguro; nunca transmitir valores, etiquetas libres, notas o importes.

Conexiones locales: primera active_day por usuario/tienda/día argentino, antes de aplicar cursor. PostHog: primer user_logged_in por identidad/tienda/día argentino, antes del cursor; la entrada local prevalece para ese usuario/día con búsqueda independiente del cursor. Esto conserva como máximo una conexión a través de páginas y actualizaciones. La última acción usa el mismo alcance y las mismas conexiones diarias.

Conservar keyset por fecha/ID, snapshot, fechas inclusivas argentinas, deduplicación de operaciones entre fuentes y aviso de fuente externa no disponible. Historial independiente del recorrido de hitos existente. Claves PostHog solo backend; timeout y proyección explícita.
