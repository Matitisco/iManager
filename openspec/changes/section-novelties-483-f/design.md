# Diseño

Una tabla SectionRecordView guarda la versión updatedAt vista por usuario, tienda, sección y registro. GET consulta metadatos de registros con versiones posteriores (incluidos archivados/anulados). POST reconoce únicamente las versiones observadas y permitidas; upsert por lote con GREATEST evita regresiones entre pestañas y no consume cambios concurrentes posteriores.

AppContext concentra carga, refresh y persistencia. La pantalla conserva una instantánea de IDs durante la visita, reconoce toda la sección (sin depender de filtros/paginación), prioriza novedades después de filtros/orden y antes de paginar. Marca mediante fondo leve/punto sin etiquetas extra; las anuladas conservan su tratamiento rosa. Errores visibles, aislamiento por usuario/tienda/permisos y respuestas antiguas descartadas. Las notificaciones siguen siendo una bandeja independiente.

Mockup generado externamente antes de implementar: /workspace/imanager-local/shots/483-f/wireframe.png. Capturas/prompts no se versionan.
