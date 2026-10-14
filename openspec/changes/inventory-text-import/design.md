# Diseño

Endpoint autenticado POST /api/import/analyze-text, autorizado por sección y limitado por tienda (por instancia del servidor). Responses API con OPENAI_API_KEY, OPENAI_IMPORT_MODEL opcional, JSON schema estricto y validación Zod. Tamaño acotado; bloques por líneas con contexto extraído exclusivamente del texto; concurrencia limitada, timeout por llamada y total. Un reintento de JSON/schema inválido, sin fallback silencioso. Normalización local contra el catálogo compartido y modelos existentes de la tienda, sin enviarlos al LLM. Proveniencia por línea y contraste de IMEI/precio/costo contra el original.

ImportModal e ImportPreviewList comparten texto y Excel. Filas con dudas resaltadas, edición por fila, exclusión y descartes con motivos. Moneda por fila y expansión acotada de cantidades tras revisión. Las series se conservan en customFields porque el IMEI tiene un contrato de 15 dígitos. Sin cambiar Prisma, sin exportar filas.

Corpus curado de ejemplos sintéticos realistas (sin datos privados aportados por usuarios), 50+ listados y expectativas independientes. CI usa mocks. Script de eval real guarda métricas por campo, alucinaciones, omisiones, latencia y costo, incluyendo 500 líneas. Tests en desktop y WebKit iPhone.
