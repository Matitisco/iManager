## 1. Instalar dependencia

- [x] 1.1 Instalar SheetJS: `npm install xlsx` en el directorio raíz del frontend. Verificar que aparece en `package.json`.

## 2. Función de exportación

- [x] 2.1 En `src/pages/Inventory.tsx`, crear la función `handleExport` que: (a) filtra `columnOrder` por columnas visibles, (b) mapea `items` a un array de objetos con los labels renombrados como keys, sustituyendo valores `"---"` por `""`, (c) usa `import('xlsx')` dinámico para lazy-load de SheetJS.
- [x] 2.2 Dentro de `handleExport`, construir el worksheet con `utils.json_to_sheet(rows)` y el workbook con `utils.book_new()` + `utils.book_append_sheet()`.
- [x] 2.3 Disparar la descarga con `writeFile(wb, \`inventory_${fecha}.xlsx\`)` donde `fecha` es `new Date().toISOString().slice(0, 10)`.

## 3. Estado de carga del botón

- [x] 3.1 Agregar estado `const [isExporting, setIsExporting] = useState(false)` en `Inventory.tsx`.
- [x] 3.2 En `handleExport`, setear `isExporting = true` al inicio y `false` en el `finally` del import dinámico.

## 4. Botón en toolbar

- [x] 4.1 En el toolbar de `Inventory.tsx` (zona de botones de acción), agregar un botón "Exportar" que llama a `handleExport`. Deshabilitar el botón mientras `isExporting` sea `true`.
- [x] 4.2 Mientras `isExporting`, mostrar texto "Exportando..." en lugar de "Exportar" (sin spinner separado — el texto es suficiente).
- [x] 4.3 Asegurar que el botón sigue el sistema de diseño existente (mismo estilo que botones secundarios del toolbar).

## 5. Verificación

- [x] 5.1 Verificar que el botón aparece en el toolbar y es clickeable.
- [x] 5.2 Verificar que el archivo descargado se llama `inventory_YYYY-MM-DD.xlsx` con la fecha actual.
- [x] 5.3 Verificar que al ocultar columnas y exportar, el XLSX no incluye las columnas ocultas.
- [x] 5.4 Verificar que con un filtro de búsqueda activo, el XLSX solo contiene los ítems filtrados.
- [x] 5.5 Verificar que celdas vacías aparecen vacías en Excel (no con "---").
- [x] 5.6 Correr `npm run lint` sin errores de TypeScript.
