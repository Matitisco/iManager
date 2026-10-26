# Diagnósticos de importación (2026-10-26)

Los endpoints `/api/import/analyze` y `/api/import/apply` agregan `diagnostics`, `missingRequiredFields` y `missingRecommendedFields`. Las claves de campos son las del catálogo (`model`, `price`, `imei`, etc.). Se calculan desde el mapeo efectivo después de validar encabezados y campos; no se confía en listas declaradas por el modelo. Los mismos diagnósticos por hoja aparecen en `summary.sheets[].diagnostics`.

```json
{
  "missingRequiredFields": ["price"],
  "missingRecommendedFields": [],
  "diagnostics": {
    "detectedRows": 2,
    "acceptedRows": 0,
    "discardedRows": 2,
    "discardedByReason": { "missing_price": 2 },
    "missingRequiredFields": ["price"],
    "missingRecommendedFields": []
  }
}
```

Ese resultado corresponde a dos equipos con Modelo, IMEI, Color, Calidad, Batería, Costo y Estado, sin Precio de venta. `rows` sigue vacío y `summary.rowCount` sigue siendo cero. No se cambia la regla vigente que descarta equipos sin precio.

`detectedRows` cuenta filas físicas dentro del rango de datos de cada plan (sin encabezado ni blancos finales recortados). Cada fila tiene exactamente un resultado; un rechazo cuenta su primer motivo. Blancos intermedios, pies, títulos de sección y hojas excluidas se cuentan como `empty`, `footer`, `section_header` y `excluded_sheet`. `acceptedRows` cuenta filas físicas retenidas, mientras que el `summary.rowCount` existente sigue contando unidades expandidas por Cantidad. Las listas globales de campos faltantes unen las de las hojas incluidas, incluso si una de esas hojas termina con cero filas. Si ninguna hoja está incluida, se unen todos los planes.

Obligatorios/recomendados de mapeo:

| Tipo | Obligatorios | Recomendados |
| --- | --- | --- |
| inventory | model, price | imei |
| sales | amount | date, clientName, device, productImei |
| clients | name | phone |
| trade-ins | clientName, deviceReceived, deviceGiven | takeValue, differencePaid |

Ventas conserva además la validación existente de tener alguna identidad (cliente/equipo/IMEI); no se inventa una clave de columna para ese grupo alternativo.

Los cuatro endpoints de persistencia agregan `diagnostics` para las filas recibidas. En esa fase los campos faltantes de mapeo son listas vacías: no se reciben encabezados ni se reconstruye un mapeo desde valores. Los IMEI existentes de inventario siguen actualizándose y cuentan como aceptados. Las ventas repetidas se rechazan como `duplicate`. Los errores de validación y guardado conservan sus mensajes anteriores.

Costo, Precio de compra, Cost price y Purchase price se bloquean como precio de venta tanto en heurísticas como al validar los dos mecanismos de mapeo del modelo. Venta, PVP, Precio USD y $ se reconocen como precio. Se refuerzan las instrucciones de mapeo siguiendo la [guía oficial de salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs); los tests usan clientes simulados, sin llamadas reales.

PostHog recibe `import_analysis_completed` (phase analyze/apply) y `import_result` (phase commit). Incluyen tipo de importación, origen, filas detectadas/preparadas/importadas/actualizadas/descartadas, motivos y campos faltantes. En análisis, importadas/actualizadas son cero porque todavía no hubo persistencia; al guardar se informan los contadores reales. Cada fase tiene su propio denominador, sin caché que mezcle archivos o tiendas. Se filtran en runtime todos los nombres de campos y motivos mediante listas cerradas; nunca se envían hojas, encabezados, IMEI, nombres, mensajes de error ni valores de celdas. Los eventos nuevos también quitan nombre, email y nombre de tienda heredados de propiedades globales del SDK antes del envío. Se mantienen las guardas existentes de desarrollo/test/automatización.

Verificación local: TypeScript frontend/backend, tests unitarios relacionados de importación y servicios, tests de API/analytics y los cuatro E2E existentes de `import-mapping`/`import-sections`. E2E con dos workers y PostgreSQL temporal ficticio exclusivo en loopback:5638; desarrollo Vite con polling por saturación de watchers del host. Sin build, cambios de componentes/JSX/CSS, migraciones ni acceso a producción.
