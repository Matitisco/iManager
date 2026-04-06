## 1. Contract and domain helpers

- [x] 1.1 Crear helpers de dominio para Ventas con filas derivadas, columnas del engine, acciones de fila y bulk actions.
- [x] 1.2 Agregar helper de exportación para Ventas que respete columnas visibles, orden y labels persistidos.
- [x] 1.3 Definir un `viewId` estable para la persistencia de preferencias de columnas de Ventas.

## 2. Refactor de la página de Ventas

- [x] 2.1 Reemplazar la tabla custom de `src/pages/Sales.tsx` por `TableEngine`.
- [x] 2.2 Conectar filtros, selección controlada, acciones de edición y confirmaciones de eliminación sobre el nuevo template.
- [x] 2.3 Mantener el panel lateral de edición y las estadísticas actuales de Ventas.
- [x] 2.4 Agregar el botón de exportación de la vista activa.

## 3. Testing

- [x] 3.1 Crear tests unitarios para los helpers de filas, columnas y exportación de la tabla de Ventas.
- [x] 3.2 Cubrir al menos un caso de selección, un caso de export y un caso de acciones de fila/bulk.
- [x] 3.3 Verificar que `npm run lint` pasa sin errores de TypeScript.

## 4. Documentation and review

- [x] 4.1 Validar que el cambio queda documentado en OpenSpec con proposal, design, spec y tasks.
- [x] 4.2 Revisar que no haya cambio de backend ni de Prisma asociado a esta migración.
