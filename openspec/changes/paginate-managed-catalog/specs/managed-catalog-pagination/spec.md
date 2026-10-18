## ADDED Requirements

### Requirement: Paginación del catálogo administrado
El desk SHALL mostrar como máximo 16 equipos por página con rango y botones al pie de la card, conservando 8 filas por página en las demás tablas y sin paginar la página pública ni modificar la vista previa.

#### Scenario: Primera, intermedia y última página
- **WHEN** hay 118 equipos y se navega a las páginas 1, 4 y 8
- **THEN** los rangos son `1–16 de 118`, `49–64 de 118` y `113–118 de 118`, con 16, 16 y 6 equipos respectivamente
- **THEN** en móvil el rango aparece centrado sobre los botones

### Requirement: Reinicio, límites y edición
El desk SHALL volver a la página 1 al cambiar la búsqueda o las reglas guardadas, ajustar páginas fuera de rango y conservar la página al editar visibilidad individual.

#### Scenario: Búsqueda o reglas modificadas
- **WHEN** se cambia la búsqueda o una regla guardada desde otra página
- **THEN** se muestra la primera página de los resultados

#### Scenario: Menos equipos o cambio de visibilidad
- **WHEN** se eliminan equipos y la página actual deja de existir
- **THEN** se muestra la última página válida
- **WHEN** se cambia la visibilidad de un equipo
- **THEN** la página actual se conserva

### Requirement: Selección entre páginas
El desk SHALL conservar la selección al navegar, mostrar el total y la cantidad en otras páginas, y seleccionar todos los resultados filtrados.

#### Scenario: Selección masiva filtrada
- **WHEN** se activa Seleccionar todos con resultados repartidos en varias páginas
- **THEN** todos los resultados filtrados quedan seleccionados y las acciones masivas reciben sus IDs
- **THEN** al navegar se conservan los checks y se actualiza el contador de otras páginas

### Requirement: Desplazamiento condicionado
El desk SHALL desplazar suavemente la lista a su inicio al cambiar de página sólo si ese inicio está fuera del área visible.

#### Scenario: Navegación desde el pie
- **WHEN** se cambia de página con el inicio de la lista fuera de vista
- **THEN** el inicio de la card vuelve al área visible, respetando la cabecera móvil
