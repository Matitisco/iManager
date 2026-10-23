## ADDED Requirements

### Requirement: Modelo local desde TAC
El sistema SHALL completar únicamente el modelo de un IMEI válido y conocido, preservando ediciones manuales y prioridad de la etiqueta Apple.

#### Scenario: Alta con TAC conocido
- **WHEN** se ingresa un IMEI con 15 dígitos y Luhn válido y el modelo está vacío sin edición manual
- **THEN** se completa el modelo localmente sin mover foco ni inferir otros campos

#### Scenario: TAC desconocido o IMEI inválido
- **WHEN** no hay coincidencia o falla Luhn
- **THEN** no se autocompleta ni se agregan mensajes

#### Scenario: Modelo corregido
- **WHEN** el usuario edita el modelo y luego cambia el IMEI
- **THEN** se conserva su edición

### Requirement: Samsung Galaxy en el mismo catálogo local
El sistema SHALL aceptar los 188 nombres Samsung Galaxy de la fuente curada en
los formularios y catálogo compartido y completar solo el modelo desde sus TAC,
conservando los comportamientos Apple.

#### Scenario: IMEI Samsung conocido
- **WHEN** se pega o escanea un IMEI Samsung de 15 dígitos con Luhn válido
- **THEN** se completa Samsung Galaxy sin inferir capacidad, color, batería, condición ni precio

#### Scenario: Edición manual Samsung
- **WHEN** el usuario edita o borra manualmente el modelo y cambia el IMEI
- **THEN** conserva esa edición, incluso con TAC de otra marca

### Requirement: Registro silencioso y agregado de TAC desconocidos
El sistema SHALL reportar únicamente el TAC de ocho dígitos de un IMEI válido
desconocido en los puntos existentes de autocompletado, sin bloquear ni mostrar
mensajes y deduplicando por sesión. No SHALL registrar identidad ni IMEI completo.

#### Scenario: TAC faltante repetido
- **WHEN** se ingresa varias veces en una sesión un TAC desconocido con Luhn válido
- **THEN** solo se envía una solicitud autenticada con el TAC y los fallos no afectan el formulario

#### Scenario: TAC conocido, IMEI inválido o stock ciego
- **WHEN** el TAC es conocido, el IMEI es inválido o se usa Control de stock ciego
- **THEN** no se registra un TAC faltante

#### Scenario: Ingesta válida concurrente
- **WHEN** el backend recibe TAC válidos autenticados de distintas sesiones
- **THEN** incrementa count atómicamente conservando firstSeenAt y actualizando lastSeenAt

#### Scenario: Cuerpo inválido o falta de autenticación
- **WHEN** el POST recibe 15 dígitos, otro formato o claves extras, o no está autenticado
- **THEN** responde 400 para cuerpo inválido o 401 sin autenticación

#### Scenario: Límite de ritmo
- **WHEN** un usuario supera 60 solicitudes válidas en un minuto
- **THEN** el exceso recibe 204 sin incrementar el contador hasta la siguiente ventana

### Requirement: Consulta de faltantes para plataforma
El sistema SHALL exponer GET /admin/imei-tac-misses solo a administradores de
plataforma verificados, con límite de 1–500 (100 por defecto), sin datos personales.

#### Scenario: Consulta autorizada
- **WHEN** un administrador consulta el endpoint
- **THEN** obtiene items con TAC, count, firstSeenAt y lastSeenAt por count descendente

#### Scenario: Dueño de tienda
- **WHEN** un dueño de tienda sin acceso de plataforma consulta el endpoint
- **THEN** recibe 403
