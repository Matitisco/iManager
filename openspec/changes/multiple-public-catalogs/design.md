# Diseño

Tablas nuevas StoreCatalog y CatalogItemPrice; la tabla previa permanece intacta. Backfill idempotente y materialización al leer para instalaciones con db push. Un único origen activo, StoreCatalog. Catálogos comparten catalogVisible. Máximo 10 incluyendo el predeterminado. Manual faltante usa lista; costo ausente produce precio a consultar. Decimal y redondeo a centavos al convertir. canSeeFinancials protege la configuración sobre costo; el resultado público nunca incluye costo. Estado activo y regeneración mantienen #376.
