## ADDED Requirements

### Requirement: Ajuste en dos pasos
El ajuste de inventario SHALL abrir directamente Columnas y mostrar únicamente Columnas y Resumen en el stepper.

#### Scenario: Navegación y encabezado
- **WHEN** se abre Ajustar importación
- **THEN** Columnas muestra las tarjetas pendientes, la selección de hojas y el encabezado colapsado; Siguiente abre Resumen y Atrás conserva las tarjetas al volver.

#### Scenario: Campos obligatorios y corrección
- **WHEN** falta Modelo o se elige Cambiar en Resumen
- **THEN** el aviso obligatorio permanece en Columnas/Resumen y bloquea importar; Cambiar vuelve a Columnas, enfoca y resalta cualquier columna, incluso ya mapeada.
