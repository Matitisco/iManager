# Diseño

Capturas de main a 1440 y 390 (iPhone 13) y mockup previo generado con imagegen usando referencias v2/v3 en /workspace/imanager-local/shots/483-i/, fuera del repositorio.

ImportModal reutiliza Sheet en todos los tamaños, con foco, Escape y protección durante envío. DM Sans, segmentado negro sobre superficie gris, dropzone accesible, filas virtualizadas compactas y footer común. CSV conserva XLSX; TXT/listado de inventario conservan analyzeInventoryText; para módulos sin analizador libre el texto con columnas usa el mismo parseWorkbook CSV y onAnalyze. Sin cambios al parser, contratos de API ni reglas de negocio. Errores de revisión se marcan en su fila y errores de persistencia conservan el contenido.
