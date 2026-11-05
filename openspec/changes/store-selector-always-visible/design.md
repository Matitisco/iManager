## Approach

Reutilizar DeskSelect y el estilo D1 para todos los tamaños de sesión. Mantener los test IDs y las opciones existentes de cambio de tienda y Balance.

Agregar una opción de navegación para OWNER sin grupo activo; los grupos ya configurados conservan su menú actual porque EnableStoreGroupCard no permite agregar una tercera tienda. Pasar un destino de foco al overlay store y reutilizar la apertura pendiente de DeskApp para esperar el cambio de ruta a Configuración. Enfocar y desplazar la tarjeta al montar el formulario, respetando el foco del modal.

## Validation

Unitarias de selector, permisos, avatar neutro y navegación/foco. Typecheck y lint frontend. Playwright con endpoints interceptados, sin backend: owner con una tienda, empleado con una tienda y owner con dos; desktop/móvil y claro/oscuro, selector cerrado y abierto.
