## ADDED Requirements

### Requirement: Validación consistente del archivo
El sistema SHALL compartir validación independiente de DB entre preview y confirmación y reportar filas físicas 1-based.

#### Scenario: Calidad libre, batería ilegible y duplicados
- **WHEN** la mayoría no vacía de una columna grade es inválida según parseQuality
- **THEN** el análisis automático SHALL sugerir calidad_origen de texto, sin modificar elecciones manuales
- **AND** batería ilegible SHALL importarse vacía con advertencia
- **AND** la segunda ocurrencia de un IMEI SHALL descartarse indicando la primera fila
- **AND** la preview SHALL excluir todos los rechazos independientes de DB

## MODIFIED Requirements

### Requirement: Normalización de valores de batería
El sistema SHALL normalizar valores decimales a porcentaje y preservar rangos válidos. Baterías ilegibles SHALL importarse vacías con advertencia por fila, sin rechazar el equipo por ese motivo.

#### Scenario: Batería en formato decimal
- **WHEN** el archivo contiene 0.84 en batería
- **THEN** la preview SHALL mostrar 84%

#### Scenario: Batería en formato de rango
- **WHEN** el archivo contiene 83-85%
- **THEN** el sistema SHALL preservar ese rango

#### Scenario: Batería ilegible
- **WHEN** una fila contiene batería ilegible
- **THEN** el sistema SHALL vaciar la batería y advertir con la fila física
