## ADDED Requirements

### Requirement: Selector propio accesible
El frontend SHALL ofrecer combobox/listbox con opciones seleccionadas en amarillo de marca, hover, bordes redondeados y sombra.

#### Scenario: Uso por teclado
- **WHEN** el usuario abre el selector y navega con flechas o Home/End
- **THEN** el foco activo se actualiza sin cambiar el valor hasta confirmar con Enter o Espacio.

#### Scenario: Cancelación
- **WHEN** el usuario presiona Escape o pulsa fuera del menú
- **THEN** el menú se cierra sin cambiar el valor y Escape conserva el modal padre.

### Requirement: Bottom sheet mobile
El selector SHALL mostrar un dialog modal en teléfonos con safe areas, objetivos táctiles grandes y foco contenido.

#### Scenario: Selección en iPhone
- **WHEN** se abre Desglose en Reportes desde un iPhone
- **THEN** las opciones aparecen en un sheet inferior sobre la navegación y seleccionar una actualiza el gráfico.

### Requirement: Reutilización y formularios
El selector SHALL reutilizarse en moneda/cotización de Configuración y conservar disabled, required y envío de name/value.

#### Scenario: Validación
- **WHEN** un formulario contiene un selector obligatorio vacío
- **THEN** se impide el envío y se enfoca el selector visible.
