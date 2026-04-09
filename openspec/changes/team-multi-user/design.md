## Context

iManager soporta actualmente un único usuario por tienda. El schema ya tiene `StoreMember` con roles `OWNER / ADMIN / SELLER` y soporte para múltiples membresías por usuario, pero no existe ningún flujo para invitar a otros usuarios ni para que el invitado acepte unirse a una tienda existente.

La autenticación usa Firebase Auth. Cada usuario se identifica por `firebaseUid` y se vincula a una tienda a través de `StoreMember`. El flujo de sesión `/api/me` ya devuelve el rol del usuario actual.

## Goals / Non-Goals

**Goals:**
- Permitir al Propietario (OWNER) invitar a nuevos usuarios a su tienda mediante un enlace con token.
- Permitir al Propietario y Socio (ADMIN) cambiar el rol de otros miembros y removerlos.
- Que el usuario invitado pueda unirse a la tienda sin crear una nueva (flujo alternativo de Onboarding).
- UI de gestión de equipo en Settings visible solo para OWNER y ADMIN.

**Non-Goals:**
- Envío de email de invitación por SMTP (el enlace se copia y envía manualmente).
- Gestión multi-tienda en la UI (el usuario puede tener múltiples membresías en PG pero la UI solo trabaja con la tienda activa).
- Permisos granulares por módulo (los roles son globales por tienda).
- Auto-registro sin invitación previa.

## Decisions

### 1. Token de invitación como UUID en Postgres, no JWT

**Decisión**: El token es un `uuid` aleatorio guardado en una tabla `StoreInvitation`.

**Alternativa**: JWT firmado con los datos de la invitación (storeId, role, email, expiry).

**Rationale**: El UUID en DB permite revocar invitaciones fácilmente. Un JWT no puede invalidarse sin una blacklist. Como las invitaciones son de bajo volumen, la query a DB en el accept no es un problema de performance.

---

### 2. Accept por token sin verificar email match

**Decisión**: Al aceptar una invitación, no se valida que el email de Firebase coincida con el email de la invitación. El token es el único factor de autenticación del acceso.

**Alternativa**: Validar que el email Firebase == email de la invitación.

**Rationale**: El Propietario manda el enlace directamente al destinatario (WhatsApp, etc.). Si alguien tiene el token, es porque el Propietario se lo mandó. Forzar la coincidencia de email crearía fricciones si el invitado usa una cuenta Google diferente a la ingresada. Se puede endurecer en el futuro.

---

### 3. Flujo de aceptación dentro del Onboarding existente

**Decisión**: La página `/invite/:token` redirige al Onboarding con el token en query param. El Onboarding detecta el token y llama a `POST /api/invitations/accept` en lugar de crear una tienda.

**Alternativa**: Una página separada `/join` para aceptar invitaciones.

**Rationale**: Reutiliza el shell de Onboarding (loading, error states, logout). Menos código nuevo. El Onboarding ya maneja el estado "usuario sin contexto de negocio" que es exactamente el caso del invitado.

---

### 4. Autorización: OWNER y ADMIN pueden gestionar, con restricciones

**Decisión**:
- OWNER puede invitar, revocar, cambiar rol, y remover a cualquier miembro excepto a sí mismo si es el único OWNER.
- ADMIN puede invitar SELLERs y otros ADMINs, pero no puede degradar ni remover a un OWNER.
- SELLER no tiene acceso a la pestaña Equipo.

**Rationale**: El OWNER tiene control total de su tienda. El ADMIN es de confianza pero no puede destituir al Propietario. Esto previene que un ADMIN tome control de la tienda.

---

### 5. Rol del usuario en sesión expuesto en `/api/me`

**Decisión**: `/api/me` ya devuelve `storeMember.role`. El frontend lo usa para condicionar la UI (mostrar/ocultar pestaña Equipo, botones de gestión).

**No requiere cambio de schema ni de endpoint** — solo leer el campo que ya está en `AppSessionResponse`.

## Risks / Trade-offs

- **Token adivinable por fuerza bruta** → Mitigation: UUID v4 (128 bits de entropía), expiración de 7 días, estado REVOKED al aceptar (un token solo funciona una vez).
- **Usuario crea tienda Y acepta invitación** → No posible: el Onboarding con token reemplaza el flujo de creación. Si el usuario ya tiene una tienda, se le puede agregar como miembro adicional sin tocar su tienda existente.
- **Race condition en accept** → La operación usa `@@unique([storeId, userId])` en `StoreMember`, por lo que un segundo intento de aceptar el mismo token simplemente falla con `UniqueConstraintViolation` — manejable.

## Migration Plan

1. Agregar `StoreInvitation` al schema y ejecutar `prisma migrate deploy` en Railway.
2. Deploy del backend con el nuevo módulo `invitations/`.
3. Deploy del frontend con la nueva pestaña y el flujo de invitación.
4. No hay datos existentes que migrar — los `StoreMember` actuales no se tocan.

**Rollback**: Remover las rutas de `/api/invitations` del `app.ts`, hacer revert del schema. Los `StoreInvitation` rows creados quedarían huérfanos pero sin efecto.

## Open Questions

- ¿El ADMIN puede invitar nuevos OWNERs? → Por ahora no. Solo OWNER puede promover a OWNER.
- ¿Qué pasa si un OWNER se remueve a sí mismo? → Bloqueado si es el único OWNER. Si hay otro OWNER, puede hacerlo.
