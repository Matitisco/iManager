## 1. Endpoint de import en backend

- [x] 1.1 `POST /api/inventory/import`: recibe array de productos, valida, persiste en bulk
- [x] 1.2 Solo `modelo` requerido; campos opcionales se ignoran si están vacíos
- [x] 1.3 Columnas custom: crear si no existen, asociar valor al producto

## 2. Componente ImportInventoryModal

- [x] 2.1 Botón "Importar" en toolbar de Inventory → abre modal
- [x] 2.2 Input de archivo acepta CSV y XLSX; parseo con SheetJS en el frontend
- [x] 2.3 Selector de hoja para archivos Excel multi-hoja
- [x] 2.4 Selector de fila de encabezado (para archivos con filas vacías antes del header)
- [x] 2.5 UI de mapeo de columnas: dropdown por cada campo del sistema
- [x] 2.6 Auto-mapeo por similaridad de nombre de columna
- [x] 2.7 Columnas no mapeadas → opción de agregar como columnas custom
- [x] 2.8 Animación de entrada suave en el modal

## 3. Normalización de datos

- [x] 3.1 Normalizar batería decimal: `0.84` → `"84%"`, `1` → `"100%"`
- [x] 3.2 Preservar rangos de batería como string: `"83-85%"` sin modificar
- [x] 3.3 Fix: restaurar bulk delete confirmation modal perdido en el refactor de battery parsing
