# Diseño

Extender Product con purchasedAt/purchaseName y el cliente HTTP con GET inventory/:id para purchaseSummary. La lista usa metadata ya cargada, sin consultas por fila. supplierId se integra a InventoryColumnFilters, su clave de paginación, limpieza y estado de navegación; el selector usa proveedores existentes y conserva identidad por id.

Detalle de equipo mantiene Sheet y pie fijo. Proveedor abre la ficha existente; Compra y aviso abren SupplierPurchaseDetail en segunda capa y permiten volver al equipo sin perder el estado elegido. Reservar un espacio para el resumen secundario durante carga y después de resolver; ignorar respuestas tardías por equipo/tienda y omitir fallos secundarios. Respetar canSeeFinancials en el detalle reutilizado y los tokens reales, incluidos azules semánticos.
