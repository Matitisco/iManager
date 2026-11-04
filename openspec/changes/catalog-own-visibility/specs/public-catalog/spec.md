## ADDED Requirements

### Requirement: Visibilidad propia compatible
El sistema SHALL crear catálogos OWN visibles por defecto y preservar los catálogos existentes GLOBAL.

#### Scenario: Ocultar en un catálogo nuevo
- **WHEN** se oculta un equipo en OWN
- **THEN** solo ese catálogo lo oculta y los equipos agregados después se incluyen por defecto si cumplen sus reglas

#### Scenario: Guardado de borrador
- **WHEN** se crea un catálogo con hiddenItemIds válidos
- **THEN** las excepciones se guardan atómicamente y la vista previa refleja el mismo resultado

#### Scenario: Compatibilidad y tienda
- **WHEN** se edita GLOBAL o se envían ids ajenos
- **THEN** GLOBAL conserva su visibilidad compartida y los ids ajenos se rechazan sin cambios parciales

### Requirement: Inclusión real en Stock
El sistema SHALL mostrar los nombres de todos los catálogos activos en los que cada equipo cumple reglas y visibilidad, sin consultas por equipo.

#### Scenario: Uno, varios o ninguno
- **WHEN** un equipo aparece en uno, varios o ningún catálogo activo
- **THEN** Stock muestra el nombre, N catálogos con detalle o guion, y filtro e insignia móvil coinciden
