## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir cargar CSV/XLSX y mapear columnas desde cada encabezado con búsqueda, letras de campos usados, alta y descarte. SHALL mantener scroll interno, header sticky, Modelo fijo y drag. En móvil SHALL abrir bottom sheet.

#### Scenario: Mover destino
- **WHEN** se elige un campo usado
- **THEN** se mueve al origen actual y el anterior queda sin asignar

#### Scenario: Revisar pendientes
- **WHEN** se pulsa N por revisar
- **THEN** se muestra la siguiente columna roja o amarilla sin cambiar la fila visible

#### Scenario: Asignar Precio
- **WHEN** se pulsa Asignar en precio faltante
- **THEN** se abre el selector filtrado en Precio sobre la primera sin asignar o la primera física si no hay libres

#### Scenario: Recuperación
- **WHEN** falla la reaplicación
- **THEN** se restaura el último plan válido
