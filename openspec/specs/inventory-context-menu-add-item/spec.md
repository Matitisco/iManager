### Requirement: Fila inline vacía para alta rápida desde menú contextual
La tabla de inventario SHALL insertar una fila inline vacía al final de la lista visible cuando el usuario selecciona "Agregar ítem" en el menú contextual. El flujo completo SHALL ocurrir sin abrir ningún modal.

#### Scenario: Activar fila inline desde menú contextual
- **WHEN** el usuario hace clic derecho sobre cualquier fila y selecciona "Agregar ítem"
- **THEN** aparece una fila vacía al final de la página actual con inputs editables para `nombre`, `categoría`, `precio` y `stock`; el foco se posiciona en el campo `nombre`

#### Scenario: Categoría preseleccionada
- **WHEN** se inserta la fila inline y hay una categoría activa en el tab seleccionado
- **THEN** el selector de categoría de la fila inline tiene preseleccionada esa categoría

#### Scenario: Guardar con Enter
- **WHEN** el usuario completa los campos y presiona Enter en cualquier input de la fila inline
- **THEN** el sistema ejecuta POST /api/inventory con los valores ingresados; la fila inline se reemplaza por el item real recién creado; no se abre ningún modal

#### Scenario: Guardar con click fuera de la fila
- **WHEN** el usuario hace click fuera de la fila inline (y el campo `nombre` no está vacío)
- **THEN** el sistema guarda el item via POST al backend; la fila inline se convierte en el item guardado

#### Scenario: Guardar o cerrar con Escape
- **WHEN** el usuario presiona Escape mientras tiene foco en cualquier campo de la fila inline
- **THEN** si el campo `nombre` está lleno el item se guarda; si está vacío la fila se cierra sin guardar y sin mostrar error

#### Scenario: Validación de nombre requerido
- **WHEN** el usuario intenta guardar (Enter o click fuera) con el campo `nombre` vacío
- **THEN** el campo `nombre` muestra indicador de error (borde rojo); la fila NO se descarta y el foco vuelve al campo `nombre`; no se ejecuta la llamada al backend

#### Scenario: Bloqueo de paginación con fila activa
- **WHEN** hay una fila inline activa y el usuario intenta cambiar de página
- **THEN** la acción de paginación no se ejecuta; se muestra un aviso indicando que hay un item sin guardar

#### Scenario: Solo una fila inline a la vez
- **WHEN** ya existe una fila inline activa y el usuario vuelve a seleccionar "Agregar ítem" en el menú contextual
- **THEN** no se inserta una segunda fila; el foco se mueve a la fila inline existente
