## Context

El módulo Inventory ya carga todos los ítems filtrados en memoria (paginación client-side). El estado `items` (filtrado + ordenado) y `columnOrder`/`columnVisibility` ya existen en `Inventory.tsx`. La exportación puede consumir esos valores directamente sin llamadas al backend.

La librería SheetJS (`xlsx`) es el estándar de facto para generación de `.xlsx` en el navegador; soporta download directo con `writeFile`.

## Goals / Non-Goals

**Goals:**
- Exportar los datos visibles (filtrados + ordenados) como `.xlsx` desde el frontend
- Respetar columnas visibles y su orden actual
- Nombre de archivo automático `inventory_YYYY-MM-DD.xlsx`
- Sin dependencia de backend

**Non-Goals:**
- Exportación de datos paginados (exporta todo el dataset filtrado, no solo la página actual)
- Exportación programada o por email
- Formatos PDF o Google Sheets

## Decisions

### 1. Librería: SheetJS (`xlsx`) — client-side

**Decisión**: Usar `xlsx` (SheetJS, paquete `xlsx`) para generar el archivo en el navegador.

**Rationale**: Es la librería más adoptada para `.xlsx` en JS. No requiere backend. Soporta `utils.json_to_sheet` + `writeFile` con download directo. Alternativa considerada: `exceljs` — más pesada (~700KB vs ~200KB de SheetJS), sin ventajas para este caso de uso.

### 2. Exportación 100% client-side

**Decisión**: No crear endpoint en el backend.

**Rationale**: Los datos ya están cargados en `items` (array filtrado). Enviarlos al backend solo para generar un archivo sería un round-trip innecesario con el mismo resultado. Las reglas del proyecto indican que lógica sensible vive en el backend — pero la generación de un archivo de descarga no es lógica de negocio sensible.

### 3. Dataset exportado: todos los filtrados, no solo la página visible

**Decisión**: Exportar `items` completo (todos los filtrados/ordenados), no `pagedItems` (página actual).

**Rationale**: El usuario espera "exportar lo que está buscando", no "exportar esta página". Con paginación client-side esto es trivial — `items` ya contiene el dataset completo post-filtro.

### 4. Columnas: respetar `columnOrder` + `columnVisibility`

**Decisión**: Mapear solo las columnas con `visible: true` en el orden actual de `columnOrder`.

**Rationale**: La exportación debe ser un reflejo fiel de lo que el usuario ve en pantalla. Si ocultó "Costo" o reordenó columnas, el XLSX debe reflejar eso.

### 5. Header de columnas: usar nombres renombrados

**Decisión**: Usar el `label` actual de cada columna (que puede haber sido renombrado por el usuario) como header del XLSX.

**Rationale**: Consistencia con lo que el usuario ve. Si renombró "Modelo" a "Marca", el header del Excel debe decir "Marca".

## Risks / Trade-offs

- **Peso del bundle**: SheetJS agrega ~200KB al bundle. Mitigación: import dinámico (`await import('xlsx')`) para lazy-load solo al hacer click en Exportar.
- **Datasets grandes**: Con miles de ítems la generación puede tardar 1-2 segundos. Mitigación: mostrar feedback visual (spinner o texto "Exportando...") durante la generación.
- **Valores `---`**: Las celdas vacías muestran `---` como placeholder en la UI. En el XLSX se exportarán como string vacío para que Excel los trate como vacíos reales, no como texto.

## Migration Plan

- No hay migración de datos ni cambios de schema.
- Deploy: Railway build automático al pushear a main.
- Rollback: revertir el commit del botón si hay issues; sin side effects en backend.

## Open Questions

- ¿Se quiere también un formato CSV como opción secundaria? (Propuesto como nice-to-have; no bloqueante para MVP)
