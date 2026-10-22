## ADDED Requirements

### Requirement: Conteo de disponibles
El sistema MUST tomar como base únicamente equipos DISPONIBLE no archivados con IMEI válido, excluyendo los disponibles sin IMEI.

#### Scenario: Estados fuera de alcance
- **WHEN** se inicia un conteo con disponibles, reservados y equipos en revisión
- **THEN** la foto y las exclusiones solo incluyen disponibles; el payload abierto sigue sin cantidades esperadas

### Requirement: Revisar y registrar
El sistema MUST mostrar Coinciden, Sin escanear, Sin cargar y Figuran vendidos con IMEI, Por revisar para cerrados sin resolución y Registrar conteo mediante RECORD. MUST retirar selección, ajustes, archivo y carga de este flujo.

#### Scenario: Conteo sin observaciones
- **WHEN** se cierra sin escaneos
- **THEN** muestra Sin escaneos sin presentar pérdidas confirmadas

#### Scenario: Registro
- **WHEN** un gestor registra un resultado
- **THEN** persiste RECORD sin mutar inventario y conserva errores visibles ante fallos

### Requirement: Presentación adaptable
El sistema MUST seguir las referencias aprobadas de 1440 y 390, con Sheet mínimo y espacio inferior para que la navegación no tape El inventario no cambia.

#### Scenario: Inicio móvil
- **WHEN** se abre Iniciar control en móvil
- **THEN** muestra una hoja inferior con Disponible, Conteo a ciegas, exclusiones y acción Iniciar conteo
