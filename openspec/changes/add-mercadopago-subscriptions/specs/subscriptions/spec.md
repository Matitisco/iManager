## Purpose

Gestionar prueba gratuita, suscripción en Mercado Pago y acceso de cada tienda sin afectar las cuentas existentes de iManager.

## ADDED Requirements

### Requirement: Legacy lifetime access
El sistema SHALL mantener gratis de por vida las cuentas existentes, sin bloqueo ni límite de usuarios, mediante cambios aditivos compatibles con db push.

#### Scenario: Existing account creates a store
- **WHEN** una cuenta anterior crea o usa una tienda luego del deploy
- **THEN** conserva el plan interno sin checkout ni vencimiento

### Requirement: No-card trial
El sistema SHALL dar a cuentas nuevas siete días de prueba sin tarjeta y mostrar días restantes en Dashboard.

#### Scenario: Trial expires
- **WHEN** se alcanza la fecha de fin de prueba sin pago vigente
- **THEN** se conservan lecturas y se rechazan escrituras de negocio desde la API

### Requirement: USD prices and ARS checkout
El sistema SHALL ofrecer Básico USD 22 mensual o 198 anual y Negocio USD 87 mensual o 783 anual, con equivalente ARS al blue vendedor confirmado antes del checkout. Sistema propio SHALL ser a medida sin checkout.

#### Scenario: Rate changes before opening checkout
- **WHEN** el owner confirma un monto cuya cotización ya cambió
- **THEN** se pide revisar el nuevo importe antes de navegar

### Requirement: Trusted subscription reconciliation
El sistema MUST validar x-signature cuando hay secreto y reconsultar preapproval sin confiar en el estado recibido, vinculando tienda, plan y email del pagador.

#### Scenario: Invalid webhook signature
- **WHEN** el secreto está configurado y la firma es incorrecta
- **THEN** se rechaza sin cambiar datos ni consultar un ID no autenticado

#### Scenario: Delayed or duplicate event
- **WHEN** llega un evento repetido o más antiguo
- **THEN** no retrocede el período pagado ni reemplaza una suscripción diferente

### Requirement: Owner billing and member limits
El sistema SHALL permitir al owner ver plan, suscribirse y cancelar en iPhone y desktop. Básico incluye un miembro y Negocio tres; el plan interno es ilimitado y la prueba permite tres.

#### Scenario: Concurrent invitations at capacity
- **WHEN** dos invitaciones intentan ocupar el último lugar
- **THEN** solo una puede incorporarse y la otra recibe un error visible

### Requirement: Operational price synchronization
El sistema SHALL crear idempotentemente cuatro planes ARS con IDs persistidos y actualizar sus montos mediante PUT, usando únicamente MP_ACCESS_TOKEN desde el entorno.

#### Scenario: Retry after plan synchronization
- **WHEN** se ejecuta nuevamente la sincronización
- **THEN** conserva IDs y actualiza importes sin crear otros cuatro planes
