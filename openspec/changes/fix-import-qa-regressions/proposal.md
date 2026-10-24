## Why
La QA con archivos de una tienda argentina expone columnas desplazadas en CSV con comas entre comillas, monedas de inventario perdidas y ventas duplicadas al repetir un archivo.

## What Changes
- Leer CSV con delimitadores habituales, campos entre comillas y saltos de línea válidos.
- Conservar la moneda explícita de cada equipo durante mapeo, preview y persistencia.
- Rechazar ventas importadas idénticas sin volver a mutar stock o saldos.
- Conservar las ventas con precio inválido para revisión y distinguir los resultados con errores.
- Conservar la altura del contenido durante la lectura para evitar encogimientos transitorios.
- Registrar la evidencia de los tres flujos reales de importación en escritorio y móvil.

## Capabilities
### New Capabilities
- `import-validation`: lectura fiel y prevención de duplicados de importación.

## Impact
Frontend de importación y servicio de ventas. Sin cambios de schema, credenciales ni servicios de producción.
