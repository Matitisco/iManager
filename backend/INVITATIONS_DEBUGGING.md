# Invitations Debugging

Guia rapida para diagnosticar el flujo de invitaciones y roles de iManager en Railway.

## Que cubre hoy el sistema

- Crear invitaciones desde `POST /api/invitations`
- Previsualizar un enlace publico desde `GET /api/invitations/preview/:token`
- Aceptar una invitacion autenticado desde `POST /api/invitations/accept`
- Listar invitaciones pendientes desde `GET /api/invitations`
- Revocar invitaciones desde `DELETE /api/invitations/:id`
- Gestion de miembros y roles desde `GET/PATCH/DELETE /api/stores/:storeId/members/*`

## Flujo esperado

1. Un `OWNER` crea la invitacion.
2. El backend genera `inviteUrl` usando `FRONTEND_URL`.
3. El invitado abre `/invite/:token`.
4. Sin sesion, la app guarda el token y muestra contexto en login.
5. El frontend consulta `GET /api/invitations/preview/:token`.
6. Tras iniciar sesion, el usuario acepta con `POST /api/invitations/accept`.
7. El backend crea la membresia, la deja como `default` y devuelve la sesion apuntando a la tienda invitada.

## Logs nuevos en Railway

El backend ahora emite eventos estructurados en el modulo de invitaciones. En Railway conviene buscar por `event`.

### Preview

- `invite_preview_ok`
  - El token existe, esta `PENDING` y no expiro.
  - Campos utiles: `tokenPrefix`, `storeName`, `role`

- `invite_preview_unavailable`
  - El preview devolvio `null`.
  - Normalmente significa token inexistente, expirado o ya no `PENDING`.
  - Campos utiles: `tokenPrefix`

- `invite_preview_error`
  - Fallo tecnico al intentar resolver el preview.
  - Campos utiles: `tokenPrefix`, `error`

### Accept

- `invite_accept_ok`
  - La invitacion se acepto correctamente.
  - Campos utiles: `tokenPrefix`, `firebaseUid`, `storeId`, `role`, `onboardingRequired`

- `invite_accept_failed`
  - La aceptacion fallo por negocio o por error tecnico.
  - Campos utiles: `tokenPrefix`, `firebaseUid`, `statusCode`, `errorMessage`
  - Casos comunes:
    - `410`: invitaron con token expirado o ya usado
    - `409`: el usuario ya era miembro de esa tienda

### Create

- `invite_create_ok`
  - La invitacion se creo correctamente.
  - Campos utiles: `storeId`, `actorRole`, `actorUserId`, `invitedRole`, `tokenPrefix`, `invitationId`

- `invite_create_failed`
  - Fallo al crear la invitacion.
  - Campos utiles: `storeId`, `actorRole`, `statusCode`, `errorMessage`
  - Caso importante:
    - `500` con `FRONTEND_URL no esta configurado...`

### List y revoke

- `invite_list_ok`
  - Se cargaron invitaciones pendientes.
  - Campos utiles: `storeId`, `actorRole`, `count`

- `invite_revoke_ok`
  - La invitacion se revoco.
  - Campos utiles: `storeId`, `actorRole`, `invitationId`

- `invite_revoke_failed`
  - Fallo al revocar.
  - Campos utiles: `storeId`, `actorRole`, `invitationId`, `statusCode`, `errorMessage`

## Que mirar cuando algo falla

### Caso: "La invitacion ya no esta disponible" apenas abrir el link

1. Buscar `invite_preview_unavailable` en Railway.
2. Confirmar si el token realmente existe en `StoreInvitation`.
3. Revisar `status` y `expiresAt`.
4. Si no hay `invite_preview_unavailable` pero si `invite_preview_error`, entonces no fue un problema de negocio sino un error tecnico.

### Caso: el invitado inicia sesion pero no entra a la tienda correcta

1. Buscar `invite_accept_ok`.
2. Verificar `storeId` del log.
3. Confirmar en DB que la nueva `StoreMember` quedo con `isDefault = true`.
4. Confirmar que otras membresias del mismo usuario quedaron con `isDefault = false`.

### Caso: el creador usa su propio link

1. Buscar `invite_accept_failed`.
2. Esperar `statusCode = 409`.
3. El `errorMessage` debe indicar que ya forma parte de la tienda.

### Caso: no se puede generar el link

1. Buscar `invite_create_failed`.
2. Si el mensaje menciona `FRONTEND_URL`, corregir la variable en Railway.

## Variables de entorno criticas

- `FRONTEND_URL`
  - Host publico real del frontend.
  - Se usa para construir el `inviteUrl`.
  - Si falta, el backend falla de forma explicita al crear invitaciones.

## Tests automatizados

Archivo principal:

- [invitations.test.ts](/abs/path/backend/src/modules/invitations/invitations.test.ts)

Cobertura actual:

- crea invitacion usando `FRONTEND_URL`
- falla si falta `FRONTEND_URL`
- previsualiza una invitacion valida
- cubre el flujo de crear enlace -> preview -> aceptar -> cambiar tienda default
- rechaza al creador o miembro existente cuando intenta usar su propio link

## Comandos utiles

```bash
cd backend
npm run lint
npm run test
```

## Tip practico para Railway

Cuando reporten un bug de invitaciones, pediles una de estas tres cosas:

- hora aproximada del intento
- email del invitado
- token completo o al menos los primeros caracteres del enlace

Con eso, en Railway podes cruzar rapido por `tokenPrefix` o por `firebaseUid` y ver si el problema fue:

- token invalido
- token expirado
- usuario ya miembro
- `FRONTEND_URL` mal configurado
- error tecnico en preview/accept
