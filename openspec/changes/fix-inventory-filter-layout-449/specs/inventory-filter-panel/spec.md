## ADDED Requirements

### Requirement: Opciones legibles y accesibles
El panel SHALL usar el ancho disponible para cada etiqueta, permitir wrap natural, ofrecer blancos táctiles de al menos 44 px y mantener las acciones del Sheet visibles sin overflow horizontal.

#### Scenario: Viewports móviles y escritorio
- **WHEN** se abre Filtros en 320/390 px o escritorio 1440 px y bajo 1536×640
- **THEN** etiquetas completas seleccionan su checkbox, se puede recorrer hasta Precio/Color y Aplicar/Limpiar permanecen accesibles.

### Requirement: Colores recorribles sin pérdida de opciones
El panel SHALL colocar batería/precio antes de colores y permitir plegar y buscar estos sin renombrarlos ni agrupar valores distintos.

#### Scenario: Lista larga y búsqueda vacía
- **WHEN** se buscan colores compuestos o históricos y luego una búsqueda sin coincidencias
- **THEN** se muestran coincidencias o un aviso, conservando las selecciones y el acceso a todas las opciones al borrar la búsqueda.

### Requirement: Borrador explícito
El panel SHALL indicar la cantidad de grupos seleccionados y conservar el contrato vigente de borrador/aplicar.

#### Scenario: Cerrar sin aplicar
- **WHEN** se edita o limpia el borrador y se cierra sin aplicar
- **THEN** los resultados vigentes no cambian y al reabrir se restauran sus filtros.

#### Scenario: Aplicar y limpiar
- **WHEN** se seleccionan filtros y se aplica, o se limpia y se aplica
- **THEN** resultados y cantidad vigente reflejan exactamente la selección confirmada.
