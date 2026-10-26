## ADDED Requirements

### Requirement: Estado vacío legible
El estado vacío de Control de stock SHALL abarcar el ancho completo de la fila.

#### Scenario: Grupo sin equipos
- **WHEN** se abre un grupo sin equipos a 1440 o 390 px
- **THEN** «Nada en este grupo» utiliza todo el ancho disponible sin caer en la columna de icono.

### Requirement: Enlace de invitación disponible
El enlace creado SHALL ser visible, seleccionable y ajustarse al ancho de la hoja.

#### Scenario: Portapapeles rechazado
- **WHEN** falla la copia del enlace creado
- **THEN** el enlace permanece visible y se puede seleccionar para copiar manualmente.

### Requirement: Concordancia de contadores
Los contadores de personas y equipos SHALL usar singular con uno y plural con cero o más de uno, fuera del módulo Fallas.

#### Scenario: Un integrante o equipo
- **WHEN** Comisiones cuenta una persona o una ficha de proveedor/origen cuenta un equipo
- **THEN** el contador muestra «persona» o «equipo» respectivamente.
