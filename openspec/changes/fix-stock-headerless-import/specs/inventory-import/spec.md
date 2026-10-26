## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir importar y ajustar CSV/XLSX identificando columnas por índice, incluso con encabezados vacíos o repetidos. Sin encabezado MUST inferir los campos por contenido, usar nombres sintéticos para todas las columnas y conservar la primera fila. MUST reincluir hojas al completar obligatorios, normalizar estados desconocidos sin error de fila y rechazar costos no numéricos usando diagnósticos existentes, sin modificar textos ni layout.

#### Scenario: Stock sin encabezado
- **WHEN** la primera fila contiene datos de equipos
- **THEN** headerRow es 0, dataStartRow es 1 y se importa esa fila

#### Scenario: Corrección del análisis inteligente
- **WHEN** OpenAI elige una fila de datos como encabezado o hay datos sobre el encabezado elegido
- **THEN** el post-proceso MUST usar headerRow=0, índices físicos, datos desde fila 1 e inferencia por contenido, incluyendo batería desde números/porcentajes y nunca desde reparaciones

#### Scenario: Plan inteligente correcto
- **WHEN** el plan de OpenAI identifica un encabezado real y mapeos válidos
- **THEN** el sistema MUST conservar sus decisiones de mapeo y transformación

#### Scenario: Ajuste de columnas ambiguas
- **WHEN** el usuario asigna los obligatorios entre columnas vacías o repetidas de una hoja excluida por faltantes
- **THEN** el plan conserva sus índices y reincluye la hoja

#### Scenario: Estado y costo
- **WHEN** una fila contiene un estado de servicio o un costo no numérico
- **THEN** el estado se normaliza sin error preservando el original y el costo inválido queda vacío sin descartar el equipo
