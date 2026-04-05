## Context

El módulo Inventory ya tiene:
- Menú contextual (clic derecho) con opciones Editar, Eliminar, Mover a categoría y bulk actions
- Edición inline via doble click: input sobre la celda, Enter guarda, Escape cancela, actualización optimista
- Endpoint `POST /api/inventory` para crear items (ya en producción)
- AppContext con `addInventoryItem` que llama al service `inventory-api.ts`

La fila inline vacía es conceptualmente una extensión del mecanismo de inline edit: en lugar de editar una celda existente, se insertan simultáneamente múltiples inputs vacíos en una fila nueva.

## Goals / Non-Goals

**Goals:**
- Nueva opción "Agregar ítem" en el menú contextual
- Al seleccionarla, insertar una fila inline vacía con inputs en los campos requeridos
- Enter/Tab en el último campo → POST al backend → fila se convierte en item real
- Escape → descarta la fila sin guardar
- Reutilizar el diseño visual del inline edit existente (borde redondeado, sin flash)

**Non-Goals:**
- No cambiar el modal existente de "Agregar ítem" (siguen coexistiendo)
- No validación en tiempo real campo por campo
- No persistencia automática por timeout
- No cambios de schema Prisma

## Decisions

### 1. Estado de la fila inline en el componente de tabla (no en AppContext)

**Decisión**: El estado `addingRow` (objeto con los valores en progreso) vive en el componente de tabla / página de Inventory, no en AppContext.

**Alternativa descartada**: Mover el estado a AppContext.

**Rationale**: Es estado UI efímero — solo existe mientras el usuario está escribiendo. AppContext es para estado de negocio persistido. Contaminar AppContext con estado de edición transitoria aumenta la complejidad y el riesgo de regresión en otros módulos.

---

### 2. Reutilizar el componente de celda inline existente

**Decisión**: La fila nueva usa el mismo componente `InlineEditCell` (o equivalente) que ya existe para la edición de celdas.

**Alternativa descartada**: Crear un componente `AddRowForm` separado.

**Rationale**: Consistencia visual y de comportamiento. Evita duplicar lógica de input/Enter/Escape. El único delta es que la fila nueva parte de valores vacíos y al guardar llama a `POST` en lugar de `PATCH`.

---

### 3. Posición de la fila inline: al final de la página actual

**Decisión**: La fila vacía se inserta al final de la lista visible (página actual), independientemente de sobre qué fila se hizo clic derecho.

**Alternativa descartada**: Insertar debajo de la fila sobre la que se hizo clic derecho.

**Rationale**: Insertar en el medio requiere gestionar índices temporales y colisionar con la paginación. Al final es predecible, consistente con el comportamiento de tablas como Notion o Airtable, y evita reordenamiento visual inesperado.

---

### 4. Campos requeridos en la fila inline

**Decisión**: La fila inline muestra inputs para los campos mínimos requeridos por el schema: `name` (required), `category` (select), `price`, `stock`. Los campos opcionales (IMEI, batería, etc.) quedan vacíos y el usuario puede editarlos luego via inline edit o panel completo.

**Rationale**: Mostrar todos los campos haría la fila inmanejable. El subconjunto mínimo permite crear el item y completarlo después con los mecanismos existentes.

---

### 5. Confirmación: Enter en último campo o Tab que sale de la fila

**Decisión**: Guardar al presionar Enter en cualquier campo o Tab al salir del último campo de la fila. Click fuera de la fila también guarda (consistente con inline edit existente).

**Rationale**: Consistente con la UX del inline edit existente. Permite flujo teclado-only para operarios que cargan stock en masa.

## Risks / Trade-offs

- **[Risk] Campos vacíos requeridos**: Si el usuario intenta guardar con `name` vacío → el backend devolverá error 400. Mitigación: mostrar el campo `name` con fondo rojo si está vacío al intentar guardar; no descartar la fila, permitir corrección.
- **[Risk] Categoría**: Si no se selecciona categoría, el item queda sin categoría (tab "Todos"). Mitigación: preseleccionar la categoría activa en el tab actual al momento de abrir la fila inline.
- **[Risk] Colisión con paginación**: Si hay 20 items en la página, la fila se inserta como item 21 visualmente pero no existe en DB hasta guardar. Al cambiar de página se descartaría. Mitigación: bloquear cambio de página mientras hay una fila inline activa (mostrar aviso).
