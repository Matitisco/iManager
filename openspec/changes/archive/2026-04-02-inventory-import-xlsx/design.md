## Context

Los usuarios con stock existente necesitaban cargar decenas o cientos de productos. La entrada manual era inviable. Los archivos de los proveedores llegan en formatos variados (CSV, XLSX), con distintas estructuras de columnas y formatos de datos (batería como decimal, como porcentaje, como rango).

## Goals / Non-Goals

**Goals:**
- Parsear CSV y XLSX en el frontend con `xlsx` (SheetJS)
- UI de mapeo de columnas: el usuario asocia columnas del archivo a campos del sistema
- Selector de fila de header y de hoja para archivos complejos
- Columnas no mapeadas → columnas custom del inventario
- Normalización de batería: `0.84` → `84%`, `1` → `100%`, `"83-85%"` → string
- Solo `Modelo` requerido; rest best-effort

**Non-Goals:**
- No hay exportación
- No hay deduplicación automática
- No se soportan formatos distintos de CSV/XLSX

## Decisions

**1. Parseo en el frontend (SheetJS)**
Evita subir el archivo crudo al backend. El frontend parsea, el usuario mapea, y solo se envía JSON al API. Alternativa (parseo en backend) descartada porque requeriría manejar multipart/form-data y añade latencia.

**2. Auto-mapeo por nombre de columna**
El sistema intenta mapear automáticamente columnas del archivo a campos del sistema por similaridad de nombre. El usuario puede corregir manualmente. Reduce fricción en archivos bien estructurados.

**3. Columnas no mapeadas → columnas custom**
En lugar de ignorar columnas no reconocidas, se crean como columnas custom. Esto preserva datos que el usuario puede querer tener aunque el sistema no los entienda.

**4. Normalización de batería en el frontend**
Los valores de batería vienen en múltiples formatos. La normalización se hace en el parser del modal antes de enviar al backend, manteniendo el tipo `string` en toda la stack.

## Risks / Trade-offs

- **Archivos grandes**: parsear un XLSX de 1000 filas en el hilo principal puede bloquear la UI. Mitigación: mostrar loading spinner; evaluar Web Worker si se convierte en problema.
- **Mapeo incorrecto**: el auto-mapeo puede equivocarse en archivos ambiguos. Mitigación: el usuario tiene control total en la UI de mapeo antes de confirmar.
