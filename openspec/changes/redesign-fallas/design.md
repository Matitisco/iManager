# Diseño

Reutilizar ScreenTitle, dstat, dcard, phone-row, Sheet y ListSkeleton. Rankings ordenados por porcentaje, desempate por cantidad. Un equipo cuenta una vez si tiene reclamo activo (incluye resueltos; excluye anulados y equipos archivados). Resumen calculado en backend sobre todos los equipos, incluidos los sin proveedor/lote; motivo sobre reclamos únicos completos, sin depender del límite de detalle. Mantener caché al revalidar y aislarla por usuario/tienda/permisos.

Detalle: tres reclamos y Ver todos en segunda hoja; móvil inferior ajustado al contenido, lista completa con volver. Reemplazar hoja antes de abrir origen o reclamo para evitar tres capas.
