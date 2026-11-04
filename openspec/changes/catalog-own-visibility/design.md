# Diseño

StoreCatalog.itemVisibility tiene default GLOBAL para preservar las filas existentes; POST /list crea OWN. CatalogItemHidden guarda excepciones por catálogo, con PK compuesta, índice por equipo y cascadas. El default histórico sigue GLOBAL. Schema autosuficiente para db push y SQL idempotente, sin backfill ni cambios a datos existentes.

PATCH /list/:id/items valida permisos, tienda y hasta 500 ids; GLOBAL conserva la operación global, OWN escribe excepciones. hiddenItemIds reemplaza las excepciones del borrador en la misma transacción del guardado. Preview usa el mismo cálculo, sin persistir. Respuestas públicas por allowlist y canSeeFinancials intacto.

Inventario consulta catálogos activos una vez y excepciones para los ids devueltos una vez; comparte reglas con el catálogo público. Expone catalogNames y catalogIncluded. AppContext refresca inventario con la respuesta autoritativa al cambiar catálogos, sin pisarlo con el default. Columna, filtro y ficha móvil usan esa inclusión.
