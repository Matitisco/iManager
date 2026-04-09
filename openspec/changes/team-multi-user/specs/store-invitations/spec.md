## ADDED Requirements

### Requirement: Propietario puede crear una invitación
El sistema SHALL permitir al usuario con rol OWNER crear una invitación de acceso para otro usuario. La invitación incluye un email de destino, un rol asignado (ADMIN o SELLER), y tiene una validez de 7 días desde su creación. El sistema SHALL retornar un token único y el enlace completo de invitación.

#### Scenario: Creación exitosa de invitación
- **WHEN** un usuario OWNER hace POST `/api/invitations` con `{ email, role }`
- **THEN** el sistema crea un registro `StoreInvitation` con status PENDING, token UUID aleatorio, y expiración en 7 días, y retorna `{ token, inviteUrl, expiresAt }`

#### Scenario: Solo OWNER puede crear invitaciones
- **WHEN** un usuario con rol ADMIN o SELLER intenta crear una invitación
- **THEN** el sistema responde 403 Forbidden

#### Scenario: No se puede invitar a un email ya miembro
- **WHEN** el email ingresado ya corresponde a un User que es miembro de la tienda
- **THEN** el sistema responde 409 Conflict con mensaje descriptivo

### Requirement: Propietario puede listar invitaciones pendientes
El sistema SHALL permitir al OWNER y ADMIN listar las invitaciones en estado PENDING de su tienda, incluyendo email, rol, fecha de creación y fecha de expiración.

#### Scenario: Listar invitaciones pendientes
- **WHEN** un OWNER hace GET `/api/invitations`
- **THEN** retorna array de invitaciones PENDING `{ id, email, role, createdAt, expiresAt }`

#### Scenario: No se muestran invitaciones expiradas ni revocadas
- **WHEN** GET `/api/invitations`
- **THEN** solo se incluyen invitaciones con status PENDING y `expiresAt > now()`

### Requirement: Propietario puede revocar una invitación
El sistema SHALL permitir al OWNER revocar una invitación PENDING, marcándola como REVOKED. Los tokens REVOKED no pueden ser aceptados.

#### Scenario: Revocar invitación existente
- **WHEN** un OWNER hace DELETE `/api/invitations/:id`
- **THEN** el sistema actualiza el status a REVOKED y retorna 200

#### Scenario: No se puede revocar invitación ya aceptada
- **WHEN** se intenta revocar una invitación con status ACCEPTED
- **THEN** el sistema responde 400 Bad Request

### Requirement: Usuario puede aceptar una invitación con su token
El sistema SHALL permitir a cualquier usuario autenticado con Firebase aceptar una invitación mediante su token. Al aceptar: se crea el `User` en PG si no existe, se crea el `StoreMember` con el rol de la invitación, y la invitación pasa a ACCEPTED.

#### Scenario: Aceptar invitación válida — usuario nuevo
- **WHEN** un usuario autenticado hace POST `/api/invitations/accept` con `{ token }`
- **AND** el token es PENDING y no ha expirado
- **AND** el usuario no tiene cuenta en PG
- **THEN** se crea el `User` en PG, se crea `StoreMember` con el rol asignado, la invitación pasa a ACCEPTED, y se retorna la sesión completa (igual que `/api/me`)

#### Scenario: Aceptar invitación válida — usuario existente con otra tienda
- **WHEN** el usuario ya tiene una tienda propia en PG
- **THEN** se crea un nuevo `StoreMember` para la tienda invitada sin tocar la membresía existente

#### Scenario: Token expirado
- **WHEN** el token tiene `expiresAt < now()` o status != PENDING
- **THEN** el sistema responde 410 Gone con mensaje "La invitación expiró o ya fue utilizada"

#### Scenario: Token inválido
- **WHEN** el token no existe en la tabla
- **THEN** el sistema responde 404 Not Found
