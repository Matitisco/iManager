## 1. Paginación

- [x] 1.1 Lógica de paginación client-side: 20 items/página
- [x] 1.2 Componente de botones numerados con elipsis
- [x] 1.3 Reset de página al cambiar filtro de categoría o término de búsqueda

## 2. Ordenamiento

- [x] 2.1 Dropdown "Ordenar" en toolbar: Modelo, Precio, Batería, Condición
- [x] 2.2 Lógica de sort client-side sobre el array de productos

## 3. Selección masiva y bulk delete

- [x] 3.1 Checkbox por fila; header checkbox selecciona todos en la página actual
- [x] 3.2 Shift+click para seleccionar rango de filas
- [x] 3.3 Barra de bulk actions aparece cuando hay selección
- [x] 3.4 Bulk delete con confirmación modal
- [x] 3.5 Escape limpia la selección

## 4. Columnas y estado

- [x] 4.1 Split `capacityColor` → columnas independientes `Capacidad` y `Color` en schema Prisma
- [x] 4.2 Columna de estado: muestra "Disponible" / "Vendido" + fecha de venta
- [x] 4.3 Campos `sold: boolean` y `soldDate: DateTime?` en schema
- [x] 4.4 Click en fila → abre modal de edición completa del producto
- [x] 4.5 Fix: restaurar InventoryEditPanel y Filters UI degradados por refactor anterior
