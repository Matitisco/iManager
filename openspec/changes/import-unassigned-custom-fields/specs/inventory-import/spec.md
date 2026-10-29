## ADDED Requirements

### Requirement: Conservar columnas sin asignar
El sistema SHALL importar automáticamente las columnas sin asignar como campos personalizados de texto, sin bloquear por esas columnas y conservando una fila por equipo y el guardado transaccional.

#### Scenario: Encabezados presentes, ausentes y duplicados
- **WHEN** se confirma una importación con columnas sin asignar
- **THEN** se conservan sus valores por índice físico, con el nombre del encabezado o «Columna <letra>», sin sobrescribir columnas duplicadas ni incluir descartes explícitos

### Requirement: Revisión informativa desde el pie
El sistema SHALL mostrar «Campo nuevo: <nombre>» con ícono + y encabezado gris, y reemplazar el chip rojo por el conteo de campos nuevos junto a Importar.

#### Scenario: Revisar en escritorio y móvil
- **WHEN** se activa Revisar
- **THEN** la tabla se desplaza horizontalmente y resalta las columnas nuevas, preservando el scroll vertical; en 390 px la línea informativa queda encima de los botones
