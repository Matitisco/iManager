## 1. Edición inline de celdas

- [x] 1.1 Estado `editingCell: { rowId, field } | null` en Inventory
- [x] 1.2 Doble click en celda → activa `editingCell`; renderiza input sobre la celda
- [x] 1.3 Enter o blur → llama `updateProduct` via PATCH; limpia `editingCell` al retornar
- [x] 1.4 Escape → limpia `editingCell` sin guardar
- [x] 1.5 Indicador visual de celda activa: borde redondeado durante la edición
- [x] 1.6 Límite de 30 caracteres en inputs de celdas de texto

## 2. Eliminación de flickers

- [x] 2.1 Optimistic update en `updateProduct`: muestra nuevo valor antes de que el API retorne
- [x] 2.2 `pendingCell` overlay: ref que fuerza el valor en el DOM sin esperar ciclo React
- [x] 2.3 Input cerrado DESPUÉS de que el API retorna, no antes
- [x] 2.4 Fix: eliminar flash de valor anterior con ref-based display override

## 3. Inputs y diseño

- [x] 3.1 Mejorar diseño del input inline: sin bordes duros, fondo transparente, mismo tamaño que celda
- [x] 3.2 Fix: save de inline edit funcionando correctamente (bug donde no guardaba)
- [x] 3.3 Fix: commit `renameCategoryApi` que faltaba en `inventory-api.ts`

## 4. batteryHealth como string

- [x] 4.1 Cambiar tipo `batteryHealth` de `number` a `string` en schema Prisma y tipos TypeScript
- [x] 4.2 Alinear tipo en frontend, backend y trade-ins
- [x] 4.3 Fix: resolver errores de tipo en trade-in batteryHealth y fix build backend
