## ADDED Requirements

### Requirement: Acción única de cierre de un reclamo anulado
El detalle de un reclamo anulado SHALL mostrar Cerrar como única acción del pie, ocupando el ancho disponible mediante el patrón existente de una sola acción. El reclamo SHALL seguir siendo de solo lectura.

#### Scenario: Cerrar desde móvil
- **WHEN** el usuario abre un reclamo anulado a 390×844
- **THEN** el pie muestra Cerrar a todo el ancho disponible y dentro del viewport
- **AND** al pulsarlo se cierra la hoja sin mutar el reclamo

#### Scenario: Cerrar desde escritorio
- **WHEN** el usuario abre un reclamo anulado a 1440×900
- **THEN** Cerrar ocupa el ancho disponible del pie sin ofrecer Guardar ni Restaurar
