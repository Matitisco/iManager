# Diseño

Conservar RecordHistoryButton y su segundo Sheet. Combinar la página de auditoría con eventos de estado sin auditoría equivalente, sólo al consultar una reparación concreta. Deduplicar por tienda, orden y estado dentro del intervalo entre eventos (Prisma puede registrar auditoría unos milisegundos después); el ingreso coincide con repair.created. Preservar autor de auditoría y no inventar autores para eventos antiguos. Aplicar filtros, orden por fecha/id y cursor antes de cortar la página combinada. La primera entrada representa el ingreso; las siguientes, transiciones. Mostrar nombres legibles en history-copy. Sin migraciones ni escrituras durante la consulta.

Pruebas unitarias de consulta y escritura, componentes en ambas vistas, suite src/desk y typecheck frontend/backend. Sin E2E ni build. Commit en español en la rama actual, sin push, según pedido explícito.
