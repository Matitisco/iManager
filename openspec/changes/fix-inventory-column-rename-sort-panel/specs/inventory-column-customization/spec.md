## MODIFIED Requirements

### Requirement: Columnas renombrables con doble click en header
El usuario SHALL poder renombrar una columna haciendo doble click en su header. El nombre tiene un límite de 30 caracteres. El nombre renombrado MUST reflejarse en todos los controles de la UI que muestran ese nombre de columna, incluyendo el panel Ordenar.

#### Scenario: Rename de columna
- **WHEN** el usuario hace doble click en un header de columna
- **THEN** aparece un input inline; Enter o blur guarda; Escape cancela

#### Scenario: Rename reflejado en panel Ordenar
- **WHEN** el usuario renombra una columna (ej. "Modelo" → "Marca")
- **THEN** el panel Ordenar muestra "Marca" en lugar de "Modelo" para esa opción de ordenación

#### Scenario: Persistencia tras recarga
- **WHEN** el usuario renombra una columna y recarga la página
- **THEN** el header y el panel Ordenar muestran el nombre renombrado; no el nombre por defecto
