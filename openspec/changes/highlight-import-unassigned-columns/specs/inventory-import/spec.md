## ADDED Requirements

### Requirement: Resaltado de columnas pendientes de asignación
El sistema SHALL resaltar con los tokens de error del design system las columnas Excel sin destino ni descarte explícito en el encabezado, todas sus celdas y su tarjeta Excel → campo. SHALL conservar el amarillo para revisión/sugerencias.

#### Scenario: Columna sin destino
- **WHEN** una columna no tiene campo asignado y no fue descartada por el usuario
- **THEN** presenta fondo rojo suave y borde o encabezado rojo en tabla y panel, incluso al seleccionarla

#### Scenario: Asignación o descarte explícito
- **WHEN** el usuario asigna un campo o elige Descartar
- **THEN** desaparece el rojo inmediatamente sin esperar la reaplicación del backend

#### Scenario: Destino reutilizado y hojas independientes
- **WHEN** se reasigna un destino a otra columna o se cambia de hoja
- **THEN** la columna desplazada vuelve a rojo y los descartes explícitos se mantienen únicamente en su hoja y encabezado
