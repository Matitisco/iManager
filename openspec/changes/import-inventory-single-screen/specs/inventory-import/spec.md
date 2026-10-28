## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir cargar un CSV o XLSX y revisar equipos en una sola pantalla con tabla de destinos y panel de asignación por columna física. SHALL conservar moneda, precio a definir, diagnósticos y confirmación real. El analizador de texto y los ajustes de otras secciones MUST conservar su comportamiento.

#### Scenario: Asignación viva y recuperación de errores
- **WHEN** se asigna, descarta o crea un campo desde el panel
- **THEN** la vista SHALL recalcular mediante apply con debounce, aceptar solo la respuesta más reciente y restaurar la última asignación válida si falla

#### Scenario: Falta Modelo
- **WHEN** una hoja incluida no tiene Modelo asignado
- **THEN** la pantalla MUST mostrar el motivo y deshabilitar Importar

#### Scenario: Vista adaptable y accesible
- **WHEN** se revisa la tabla con mouse, touch o teclado
- **THEN** SHALL permitir redimensionar y reordenar visualmente, conservar Modelo fijo y desplegar el panel de columnas sobre la tabla en móvil
