## 1. Frontend — Estado y lógica de fila inline

- [x] 1.1 Agregar estado `addingRow` (objeto con campos vacíos + flag `active`) en el componente de Inventory, fuera de AppContext
- [x] 1.2 Implementar función `startAddRow(currentCategory)` que inicializa `addingRow` con la categoría activa preseleccionada
- [x] 1.3 Implementar función `cancelAddRow()` que limpia `addingRow` sin llamar al backend
- [x] 1.4 Implementar función `commitAddRow()` que valida que `nombre` no esté vacío y llama a `addInventoryItem` de AppContext; en caso de error, no descarta la fila

## 2. Frontend — Componente de fila inline vacía

- [x] 2.1 Crear componente `AddItemRow` (o fila especial en el renderizador de tabla) que muestra inputs para `nombre`, `categoría` (select), `precio` y `stock` con el mismo estilo visual que `InlineEditCell`
- [x] 2.2 Preseleccionar la categoría activa en el selector al montar el componente
- [x] 2.3 Conectar Enter en cualquier campo → `commitAddRow()`
- [x] 2.4 Conectar Escape en cualquier campo → `cancelAddRow()`
- [x] 2.5 Conectar click fuera de la fila (onBlur de la fila completa) → `commitAddRow()` si `nombre` no está vacío
- [x] 2.6 Mostrar indicador de error (borde rojo) en el campo `nombre` cuando se intenta guardar vacío; mantener foco en `nombre`

## 3. Frontend — Integración en la tabla

- [x] 3.1 Renderizar `AddItemRow` al final de la lista visible cuando `addingRow.active === true`
- [x] 3.2 Bloquear cambio de página mientras `addingRow.active === true`; mostrar aviso "Hay un ítem sin guardar"
- [x] 3.3 Garantizar que no se puede abrir una segunda fila inline si ya hay una activa (ignorar llamadas a `startAddRow` si `addingRow.active`)

## 4. Frontend — Menú contextual

- [x] 4.1 Agregar opción "Agregar ítem" al menú contextual existente, posicionada antes de "Editar"
- [x] 4.2 Conectar la opción "Agregar ítem" al handler `startAddRow(currentCategory)`
- [x] 4.3 Verificar que las opciones existentes (Editar, Eliminar, Mover a categoría, bulk actions) siguen funcionando sin cambios

## 5. Verificación

- [x] 5.1 Flujo completo: clic derecho → Agregar ítem → llenar campos → Enter → item aparece en tabla
- [x] 5.2 Flujo Escape: clic derecho → Agregar ítem → Escape → tabla sin cambios
- [x] 5.3 Validación: intentar guardar con nombre vacío → borde rojo, fila persiste
- [x] 5.4 Categoría preseleccionada cuando hay tab activo
- [x] 5.5 Bloqueo de paginación con fila activa
- [x] 5.6 `npm run lint` pasa en frontend sin errores TypeScript
