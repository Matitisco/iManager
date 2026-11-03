## Decisions
La sesión incluirá `membership.id`, tomado de la membresía ya resuelta para la tienda activa. No se infiere identidad por nombre, rol ni ID de usuario.

El formulario de venta nueva seleccionará ese ID solo si existe entre `commissionSellers`. Esperará la carga tardía del directorio; una marca de inicialización y el registro de cambios manuales evitarán sobrescribir la elección durante nuevos renders. Editar ventas o retomar canjes mantiene sus valores guardados, incluido null.

Desktop y mobile comparten OperationForm. Tests con contexto simulado cubrirán ambos tamaños; el servicio de sesión se prueba con dependencias simuladas, sin DB.
