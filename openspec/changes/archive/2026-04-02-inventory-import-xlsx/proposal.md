## Why

La carga manual de inventario item por item era el principal cuello de botella en el onboarding de tiendas con stock existente. Se implementó importación desde archivos CSV y XLSX para que los usuarios puedan cargar decenas o cientos de productos en un solo paso.

## What Changes

- Modal `ImportInventoryModal` con UI de mapeo de columnas (columnas del archivo → campos del sistema)
- Selector de fila de encabezado (para archivos con filas vacías antes del header)
- Selector de hoja para archivos Excel multi-hoja
- Auto-agregado de columnas no mapeadas como columnas custom del inventario
- Normalización de valores de batería en formato decimal (`0.84` → `84%`, `1` → `100%`)
- Solo el campo `Modelo` es obligatorio; el resto se importa best-effort
- Animación de entrada suave en el modal

## Capabilities

### New Capabilities

- `inventory-import`: Importación de productos desde CSV/XLSX con mapeo interactivo de columnas

### Modified Capabilities

- `inventory-columns`: Soporte para columnas custom creadas automáticamente desde columnas no mapeadas del archivo

## Impact

- **src/pages/Inventory.tsx**: botón "Importar" en toolbar → abre modal
- **src/components/ImportInventoryModal.tsx**: componente nuevo con toda la lógica de parsing y mapeo
- **src/services/inventory-import-api.ts**: servicio HTTP para el endpoint de import
- **backend/src/modules/inventory/**: endpoint `POST /api/inventory/import` que valida y persiste los items

## Non-goals

- No se soporta exportación (solo importación)
- No hay validación de duplicados en el import
- No se soportan formatos distintos de CSV y XLSX
