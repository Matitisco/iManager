## 1. Schema y migración (Backend)

- [x] 1.1 Agregar modelo `StoreInvitation` al schema de Prisma (token uuid, email, role, storeId, status PENDING/ACCEPTED/REVOKED, expiresAt, createdAt)
- [x] 1.2 Agregar relación `StoreInvitation[]` al modelo `Store` en schema.prisma
- [x] 1.3 Ejecutar `npx prisma migrate dev --name add-store-invitations` y commitear el archivo de migración
- [x] 1.4 Regenerar Prisma Client (`npx prisma generate`)

## 2. Módulo de invitaciones — Backend

- [x] 2.1 Crear `backend/src/modules/invitations/invitations.routes.ts` con las rutas: POST `/`, GET `/`, DELETE `/:id`, POST `/accept`, GET `/preview/:token`
- [x] 2.2 Crear `backend/src/modules/invitations/invitations.service.ts` con lógica: crear invitación (valida OWNER, email no miembro, genera UUID, setea expiresAt +7d), listar PENDING no expiradas, revocar (valida status PENDING), aceptar (valida token, crea User si no existe, crea StoreMember, marca ACCEPTED), preview (sin auth, solo storeName y role)
- [x] 2.3 Registrar el módulo en `backend/src/app.ts` con prefix `/api/invitations`
- [x] 2.4 Agregar middleware de autorización en rutas que requieren OWNER o ADMIN (reutilizar patrón de `requireAuth` existente + verificar rol desde StoreMember)

## 3. Endpoints de gestión de miembros — Backend

- [x] 3.1 Agregar ruta PATCH `/api/stores/:storeId/members/:memberId` en `backend/src/modules/stores/stores.routes.ts` para cambiar rol (valida: actor es OWNER o ADMIN, ADMIN no puede cambiar OWNERs, no puede dejar tienda sin OWNER)
- [x] 3.2 Agregar ruta DELETE `/api/stores/:storeId/members/:memberId` para remover miembro (mismas validaciones: no eliminar único OWNER, ADMIN no puede eliminar OWNERs)
- [x] 3.3 Agregar ruta GET `/api/stores/:storeId/members` que retorna lista de miembros con User info (displayName, email, avatarUrl, role, createdAt)

## 4. Servicio frontend de invitaciones

- [x] 4.1 Crear `src/services/invitations-api.ts` con funciones: `createInvitation`, `listInvitations`, `revokeInvitation`, `acceptInvitation`, `previewInvitation`
- [x] 4.2 Crear `src/services/members-api.ts` con funciones: `listMembers`, `updateMemberRole`, `removeMember`

## 5. Ruta de invitación en el frontend

- [x] 5.1 Agregar ruta `/invite/:token` en `src/App.tsx` (o el router) que redirige a `/` con `?invite=<token>` preservando el token para después del login de Firebase

## 6. Flujo Onboarding con invitación

- [x] 6.1 Modificar `src/pages/Onboarding.tsx` para detectar `?invite=<token>` en la URL al montarse
- [x] 6.2 Implementar llamada a `previewInvitation(token)` al detectar el token y mostrar pantalla "Te invitaron a unirte a [nombre de tienda] como [rol]"
- [x] 6.3 Implementar botón "Unirme a [nombre de tienda]" que llama a `acceptInvitation(token)` y al éxito recarga la sesión con `refreshSession()` desde AppContext
- [x] 6.4 Manejar token inválido/expirado: mostrar mensaje de error con opción de crear tienda propia (volver al flujo normal)
- [x] 6.5 Asegurarse de que al aceptar exitosamente, el Onboarding desaparece y el usuario entra a la app (el `onboardingRequired` en AppContext pasa a `false`)

## 7. AppContext — rol en sesión

- [x] 7.1 Verificar que `appSession.storeMember.role` ya está expuesto en `AppContext.tsx` y en `AppSessionResponse` del backend (debería estar, revisar `session.service.ts`)
- [x] 7.2 Si no está, agregarlo: incluir `role` en `serializeSessionUser` del `session.service.ts` y en `AppUserSummary` / `AppSessionResponse` del frontend

## 8. Pestaña Equipo en Settings — UI

- [x] 8.1 Agregar pestaña "Equipo" en `src/pages/Settings.tsx` visible solo si `appSession.storeMember.role === 'OWNER' || 'ADMIN'`
- [x] 8.2 Implementar lista de miembros actuales: avatar, nombre, email, badge de rol en español (Propietario/Socio/Vendedor), fecha de ingreso
- [x] 8.3 Implementar selector de rol inline para cada miembro (solo OWNER puede cambiar a OWNER; ADMIN puede cambiar SELLER↔ADMIN; con restricciones del backend)
- [x] 8.4 Implementar botón "Remover" por miembro con `ConfirmModal` antes de ejecutar
- [x] 8.5 Implementar botón "Invitar" que abre modal con campo email + selector de rol (Socio / Vendedor)
- [x] 8.6 Al confirmar invitación, mostrar el enlace generado con botón "Copiar enlace" (usar `navigator.clipboard.writeText`)
- [x] 8.7 Implementar sección "Invitaciones pendientes" con lista de invitaciones PENDING, email, rol, expiración, y botón "Revocar" (solo OWNER) con `ConfirmModal`
- [x] 8.8 Todos los llamados a la API deben mostrar error visible si fallan (no cerrar modal como éxito si persiste falla)
