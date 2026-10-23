# Tareas

- [x] Aplicar presentación móvil de Control de stock y modal de inicio.
- [x] Aplicar presentación móvil de Historial sin rediseñar su detalle.
- [x] Omitir Después sobre valores sin Antes real y cubrir con pruebas.
- [x] Actualizar componentes/selectores afectados y verificar Vitest y typecheck.

Validación de la fase móvil anterior: TypeScript frontend/backend y 122 pruebas Vitest de StockCountScreen, HistoryScreen, history-copy, RecordHistoryButton, GroupTabs, DeskApp y patrones móviles aprobados. En esa fase, las reglas CSS fuera de `max-width: 760px` se conservaron. Actualizadas expectativas de #318 en el E2E existente; sin E2E nuevos/ejecutados, build, commit ni push.

## Ampliación modal-v3

- [x] Incorporar variante detail al Sheet compartido con tokens, encabezado fijo, scroll interno y footer responsive.
- [x] Aplicar A/C: autor y fecha en una fila, equipo/IMEI, comparación real y valores nuevos sin etiquetas de comparación.
- [x] Aplicar B con los contadores existentes, sin fabricar listas ni modificar backend; conectar Ver control a la pestaña existente con permisos.
- [x] Retirar las reglas antiguas de HistoryDetail en audit-layout para que no dupliquen ni desplacen el Sheet compartido.
- [x] Verificar Vitest de componentes/layout y typecheck frontend/backend; registrar resultados.

Validación modal-v3: typecheck frontend/backend aprobado. 149 pruebas en 10 archivos Vitest aprobadas (HistoryScreen, history-copy, RecordHistoryButton, Sheet detail/compatibilidad, capas modales, StockCountScreen, patrones móviles, GroupTabs y DeskApp); última pasada de Historial/layout: 38/38. Geometría del componente real verificada en 1440×900, 1440×480, 390×844 y 320×568: ancho, máximo de altura, centrado/bottom sheet, acción de 48/50 px y scroll sin desplazar encabezado/footer. Previews de A/B/C generadas con fixtures en 1440/390 e inspeccionadas en `/tmp/imanager-history-detail/`; el archivo temporal se retiró. Sin E2E ejecutados/agregados, backend, Prisma, build, commit ni push.

## Variante B completa — equipos del control cerrado

- [x] Consultar el control cerrado con el cliente existente, descartando respuestas tardías y sin mensajes de carga/error ni reintento.
- [x] Convertir los contadores del evento en selectores y mostrar la lista por grupo con ícono compartido, tarjeta, scroll y degradé condicional.
- [x] Cubrir grupos, contadores históricos, carga, ausencia de datos, permisos y respuestas tardías con Vitest de componentes; ejecutar typecheck y pruebas relevantes.

Validación variante B: typecheck frontend/backend y 116 pruebas en 7 archivos Vitest aprobados (HistoryScreen, StockCountScreen, history-copy, RecordHistoryButton, patrones móviles, Sheet detail y capas modales). Cobertura con fetchStockCount mockeado para grupos, selección inicial, contadores del evento distintos de las longitudes, IMEI/modelo reales, carga sin texto, errores 403/404/lectura, datos ausentes/vacíos, permiso de solo Historial, cierre/cambio de evento y degradé al hacer scroll hasta el final. Sin cambios de backend, build, E2E, commit ni push.
