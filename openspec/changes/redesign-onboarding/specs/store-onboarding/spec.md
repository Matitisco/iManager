## MODIFIED Requirements

### Requirement: Onboarding crea Store y StoreMember OWNER
El sistema SHALL crear una tienda con su nombre como único dato requerido, USD y dólar blue automático por defecto, y membresía OWNER. El flujo SHALL permitir revisar stock antes de cualquier guardado, cargar Excel o manualmente, omitir o crear muestras identificadas por servidor.

#### Scenario: Cuenta nueva
- **WHEN** una cuenta sin membresía registra el nombre
- **THEN** se crea la tienda y abre video opcional, luego invitación opcional y finalmente carga; la sesión persiste el avance

#### Scenario: Cuenta existente
- **WHEN** una tienda sin fecha de inicio entra
- **THEN** no se muestra el flujo ni la checklist automáticamente, pero Ayuda permite abrir checklist y video

## ADDED Requirements

### Requirement: Revisión del stock valorizado
El sistema SHALL reutilizar #338 con resultados parciales y confirmación explícita; SHALL contar equipos según cantidades, mostrar valores USD/ARS con tasa real y conservar dudas como marca visible sin bloquear guardado.

#### Scenario: Lista parcialmente reconocida
- **WHEN** hay líneas descartadas
- **THEN** pueden editarse y reanalizarse o continuar con las reconocidas sin guardar aún

#### Scenario: Texto ajeno
- **WHEN** no se reconocen equipos
- **THEN** se muestra ejemplo y alternativas Excel y manual

### Requirement: Primeros pasos y Ayuda
El sistema SHALL mostrar solamente los pasos pendientes y persistir descarte y avances, derivar stock/venta/equipo/catálogo de datos reales y limitar invitación a OWNER/MANAGER. El video SHALL ser opcional, configurable, con poster y carga al abrir desde checklist o Ayuda; instalación SHALL reutilizar guía PWA.

#### Scenario: Checklist cerrada
- **WHEN** el usuario la cierra y recarga
- **THEN** permanece cerrada y puede reabrirse desde Ayuda

### Requirement: Muestras aisladas
El sistema SHALL marcar muestras en el servidor y borrar exclusivamente registros de ejemplo de la tienda actual tras confirmación.

#### Scenario: Convivencia con datos reales
- **WHEN** se confirma borrar muestras
- **THEN** los registros reales y las otras tiendas permanecen intactos
