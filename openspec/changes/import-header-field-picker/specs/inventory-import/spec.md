## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir cargar CSV/XLSX y mapear columnas desde cada encabezado con búsqueda, letras de campos usados, alta y descarte. SHALL mantener scroll interno, header sticky, Modelo fijo y drag. En móvil SHALL abrir bottom sheet.

#### Scenario: Mover destino
- **WHEN** se elige un campo usado
- **THEN** se mueve al origen actual y el anterior queda sin asignar

#### Scenario: Revisar pendientes
- **WHEN** se pulsa N por revisar
- **THEN** el conteo incluye solo columnas asignadas con dudas y se muestra la siguiente columna amarilla en orden visual sin cambiar la fila visible
- **AND** el header de cada columna con dudas se pinta de amarillo

#### Scenario: Columnas sin asignar
- **WHEN** hay columnas sin asignar
- **THEN** se muestra aparte N sin asignar › en rojo y recorre solo las columnas rojas en orden visual
- **AND** cada chip mantiene su propio recorrido circular y se oculta cuando su conteo es cero
- **AND** las columnas descartadas no cuentan en ninguno de los dos chips

#### Scenario: Asignar Precio
- **WHEN** se pulsa Asignar en precio faltante
- **THEN** se abre el selector filtrado en Precio sobre la primera sin asignar o la primera física si no hay libres

#### Scenario: Recuperación
- **WHEN** falla la reaplicación
- **THEN** se restaura el último plan válido
