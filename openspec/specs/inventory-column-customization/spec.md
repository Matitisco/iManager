### Requirement: Columnas redimensionables con drag handle
Cada columna de la tabla SHALL tener un drag handle en su borde derecho que permite ajustar el ancho arrastrando. El ancho mínimo (MIN_COL_WIDTH) MUST respetarse.

#### Scenario: Resize de columna
- **WHEN** el usuario arrastra el handle del borde derecho de una columna
- **THEN** el ancho de la columna cambia en tiempo real; no puede reducirse por debajo de MIN_COL_WIDTH

### Requirement: Columnas reordenables con drag del header
El usuario SHALL poder reordenar columnas arrastrando el header. Durante el drag se muestra un pill flotante con el nombre de la columna y el cursor está oculto.

#### Scenario: Reordenar columnas
- **WHEN** el usuario arrastra el header de una columna a otra posición
- **THEN** las columnas se reorganizan en el nuevo orden; se muestra un indicador vertical de posición de drop

### Requirement: Columnas renombrables con doble click en header
El usuario SHALL poder renombrar una columna haciendo doble click en su header. El nombre tiene un límite de 30 caracteres.

#### Scenario: Rename de columna
- **WHEN** el usuario hace doble click en un header de columna
- **THEN** aparece un input inline; Enter o blur guarda; Escape cancela
