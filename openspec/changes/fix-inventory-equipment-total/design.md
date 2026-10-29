# Diseño

Derivar el conteo y desglose de `inventory` en `OnboardingInventorySummary`, excluyendo `archivedAt`. Usar plurales de los estados nativos y conservar estados personalizados; tratar el estado vacío como disponible, igual que `isInStock`. El resumen no depende de búsqueda, filtros ni paginación. Reutilizar las tarjetas y su texto pequeño, permitiendo varias líneas en móvil. Mantener intacto el cálculo de valor del stock.

La tabla también puede incorporar archivados como filas atenuadas mediante `mergeRecordRows`. Esas filas complementarias no se incluyen en este KPI de equipos no archivados ni se cambia su comportamiento.

La CLI OpenSpec no está instalada en este entorno; se registran los cuatro artefactos manualmente antes de implementar, siguiendo el alcance aprobado en el pedido.
