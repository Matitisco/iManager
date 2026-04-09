## ADDED Requirements

### Requirement: OWNER y ADMIN pueden ver los miembros del equipo
El sistema SHALL mostrar la lista de miembros activos de la tienda en la pestaña "Equipo" de Settings. La lista incluye: nombre, email, avatar, rol en español, y fecha de ingreso. La pestaña solo es visible para usuarios con rol OWNER o ADMIN.

#### Scenario: OWNER ve la pestaña Equipo
- **WHEN** un usuario con rol OWNER navega a Settings
- **THEN** ve la pestaña "Equipo" con la lista de miembros y su propio rol marcado

#### Scenario: SELLER no ve la pestaña Equipo
- **WHEN** un usuario con rol SELLER navega a Settings
- **THEN** la pestaña "Equipo" no aparece en la navegación de Settings

#### Scenario: Roles se muestran en español
- **WHEN** se muestra la lista de miembros
- **THEN** OWNER → "Propietario", ADMIN → "Socio", SELLER → "Vendedor"

### Requirement: OWNER puede cambiar el rol de un miembro
El sistema SHALL permitir al OWNER cambiar el rol de cualquier miembro de la tienda, con las siguientes restricciones: no se puede degradar al único OWNER, no se puede promover a OWNER si el actor no es OWNER.

#### Scenario: OWNER cambia rol de SELLER a ADMIN
- **WHEN** un OWNER selecciona un miembro con rol SELLER y elige "Socio" en el selector de rol
- **THEN** el sistema hace PATCH `/api/stores/:storeId/members/:memberId` y actualiza el rol

#### Scenario: No se puede degradar al único OWNER
- **WHEN** el OWNER intenta cambiar su propio rol y es el único OWNER de la tienda
- **THEN** el sistema responde 400 con mensaje "No puede haber una tienda sin Propietario"

#### Scenario: ADMIN no puede cambiar rol de un OWNER
- **WHEN** un usuario con rol ADMIN intenta cambiar el rol de un miembro OWNER
- **THEN** el sistema responde 403 Forbidden

### Requirement: OWNER y ADMIN pueden remover un miembro
El sistema SHALL permitir al OWNER remover cualquier miembro (excepto al único OWNER). El ADMIN puede remover SELLERs y otros ADMINs, pero no a OWNERs.

#### Scenario: OWNER remueve a un miembro SELLER
- **WHEN** un OWNER hace DELETE `/api/stores/:storeId/members/:memberId` sobre un SELLER
- **THEN** se elimina el `StoreMember` y retorna 200

#### Scenario: No se puede remover al único OWNER
- **WHEN** se intenta eliminar el único miembro con rol OWNER
- **THEN** el sistema responde 400 con mensaje descriptivo

#### Scenario: ADMIN no puede remover a un OWNER
- **WHEN** un ADMIN intenta remover a un miembro con rol OWNER
- **THEN** el sistema responde 403 Forbidden

### Requirement: OWNER puede invitar desde la pestaña Equipo
El sistema SHALL mostrar un botón "Invitar" en la pestaña Equipo que abre un modal. El modal permite ingresar email y seleccionar rol (Socio o Vendedor). Al confirmar, se genera el enlace de invitación que se puede copiar al portapapeles.

#### Scenario: Flujo de invitación exitoso desde UI
- **WHEN** el OWNER hace clic en "Invitar", completa el email y rol, y confirma
- **THEN** el modal muestra el enlace de invitación generado con un botón "Copiar enlace"

#### Scenario: Enlace se copia al portapapeles
- **WHEN** el usuario hace clic en "Copiar enlace"
- **THEN** el enlace se copia al portapapeles y se muestra feedback visual ("¡Copiado!")

### Requirement: Lista de invitaciones pendientes en la pestaña Equipo
El sistema SHALL mostrar las invitaciones en estado PENDING debajo de la lista de miembros. Cada invitación muestra: email, rol asignado, fecha de expiración, y botón "Revocar" (solo para OWNER).

#### Scenario: Ver invitaciones pendientes
- **WHEN** un OWNER está en la pestaña Equipo
- **THEN** ve una sección "Invitaciones pendientes" con las invitaciones no expiradas

#### Scenario: Revocar invitación desde UI
- **WHEN** el OWNER hace clic en "Revocar" sobre una invitación pendiente
- **THEN** aparece un modal de confirmación, al confirmar la invitación desaparece de la lista
