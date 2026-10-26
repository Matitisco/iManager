# Diseño

InventoryItem.price y el snapshot del conteo admiten null mediante DROP NOT NULL aditivo. Los importes ausentes no son cero ni reemplazan precios existentes al reimportar. La UI presenta «A definir», los filtros distinguen null y la venta exige importe positivo. Catálogo, conteo, exportación y serializers conservan la ausencia. Variantes a/b seleccionables por query importVariant; mismo comportamiento y persistencia. QA exclusivamente PostgreSQL ficticio local.

A usa aviso compacto, mapeo tabular y proveedor inline; B usa franja lateral, tarjetas de mapeo y segunda hoja. El contador de descartes por falta de modelo se expone como summary.discardedRows; la rama paralela de motivos no estaba mergeada al comenzar. Los encabezados repetidos y las etiquetas de sección se mantienen fuera de los equipos importados, aunque no haya precio. El filtro pendiente se conserva hasta montar Inventario al navegar desde un proveedor.
