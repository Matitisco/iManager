# Diseño

StorePublicCatalog 1:1 con Store guarda configuración y slug aleatorio; InventoryItem.catalogVisible default false. Las escrituras son OWNER-only, atómicas, aisladas por tienda y auditadas. Endpoint público sin auth aplica visibilidad/reglas antes de proyectar campos permitidos; no-store y límite por IP. Página /c/:slug fuera del proveedor de sesión, lista agrupada responsive sin fotos. Servidor SPA entrega metadatos OG; preview PNG generado desde nombres/modelos/cantidades públicos. No endpoint de exportación. Revalidación periódica y al recuperar foco.
