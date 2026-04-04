---
description: Guía de debugging para iManager — fallos en Railway, Firebase, sesión, Prisma y el bridge frontend↔backend.
---

# Debug — Diagnosticar problemas en iManager

Usar cuando algo falla en producción o desarrollo y no está claro por qué.

---

## Mapa de síntomas → causa probable

| Síntoma en frontend | Causa probable |
|--------------------|---------------|
| Banner "backend offline" permanente | Railway caído / env vars incorrectas / CORS |
| `backendStatus` atascado en `'checking'` | `/api/me` no responde — Railway en cold start o crasheado |
| Datos de Firestore en vez de Postgres | Backend offline, frontend cayó al fallback |
| Error 401 en cualquier endpoint | Token Firebase inválido o expirado |
| Error 403 "Store membership required" | Usuario autenticado pero sin StoreMember en PG |
| Error 500 en `/api/me` | Variables de entorno de Firebase mal configuradas |
| Datos vacíos aunque el backend responde 200 | `storeId` no resuelto — ver `resolveAppUser` middleware |
| Módulo muestra datos viejos después de crear | AppContext no actualizó el estado local |

---

## 1. Railway — verificar estado del deploy

**Síntoma:** backend offline, requests no llegan.

Pasos:
1. Ir a Railway dashboard → servicio `efficient-magic` → pestaña Deployments
2. Ver si el último deploy está en estado `Active` o `Failed`
3. Si está `Failed`: ver los logs del build → buscar el error de TypeScript o de dependencias

**Causas frecuentes de deploy fallido:**
- Error de TypeScript en `backend/` (correr `/test` antes de pushear)
- `package.json` con dependencia faltante
- `prisma db push` fallando por un campo `NOT NULL` sin default en una tabla con datos

---

## 2. Variables de entorno de Firebase en Railway

**Síntoma:** error 500 en `/api/me`, logs del backend dicen algo como `FirebaseAppError` o `invalid private key`.

Las variables necesarias en Railway:

```
FIREBASE_PROJECT_ID       → el project ID del proyecto Firebase
FIREBASE_CLIENT_EMAIL     → el email de la service account
FIREBASE_PRIVATE_KEY      → ⚠️  ver abajo
FIRESTORE_DATABASE_ID     → nombre del database de Firestore (no "default", el nombre real)
DATABASE_URL              → connection string de PostgreSQL de Railway
```

### El problema clásico de `FIREBASE_PRIVATE_KEY`

La private key contiene saltos de línea reales (`\n`). Cuando se copia desde el JSON de la service account al env var de Railway, los `\n` pueden quedar como literales en lugar de newlines reales.

**Verificar:** En los logs de Railway, si el error dice `error:09091064:PEM routines:PEM_read_bio:no start line`, la key está mal formateada.

**Fix:** En Railway, el valor de `FIREBASE_PRIVATE_KEY` debe tener saltos de línea reales. Al pegarlo, usar el valor tal como viene en el JSON (con `\n` literales) — Railway los interpreta correctamente si se pega el string crudo de JSON.

---

## 3. `/api/me` devuelve `onboardingRequired: true`

**Síntoma:** la app muestra la pantalla de onboarding aunque el usuario ya hizo onboarding.

Causas:
- No existe un `StoreMember` para ese `firebaseUid` en la base de datos
- El `firebaseUid` del usuario cambió (si se recreó la cuenta de Firebase)

**Verificar con Prisma Studio:**
```bash
cd backend && npx prisma studio
```
Buscar el usuario en la tabla `User` por `firebaseUid` → verificar que tiene un `StoreMember` con `isDefault: true`.

**Fix si falta:**
```bash
cd backend && npm run bootstrap:owner -- --firebaseUid <uid>
```

---

## 4. Error 403 "Store membership required"

**Síntoma:** el backend devuelve 403 en cualquier endpoint de datos.

Causa: el middleware `resolveAppUser` no pudo resolver el `storeId` para el token. Esto pasa cuando:
- El usuario tiene `User` en PG pero no tiene `StoreMember`
- La `StoreMember` no tiene `isDefault: true`

Verificar en Prisma Studio: tabla `StoreMember` → buscar por `userId`.

---

## 5. Backend responde pero el frontend muestra datos de Firestore

**Síntoma:** la UI muestra datos viejos de Firestore aunque el backend está activo.

El frontend tiene el bug del `onSnapshot` redundante de `tradeIns` (línea ~179 en AppContext) que sobreescribe los datos del backend. Ver skill `/harden` para el fix.

Para otros módulos: verificar que `backendStatus === 'ready'` en el estado del contexto usando las DevTools de React.

---

## 6. `prisma db push` falla en Railway al deployar

**Síntoma:** el deploy falla con un error de Prisma en el log del start command.

Causas frecuentes:
- Se agregó un campo `NOT NULL` sin default a una tabla que ya tiene filas → hacer el campo opcional o agregar default
- `DATABASE_URL` no está configurada en Railway → verificar en Settings > Variables
- La versión de `@prisma/client` no coincide con el schema → correr `npx prisma generate` localmente y commitear

---

## 7. CORS error en el frontend

**Síntoma:** en la consola del browser aparece `Access-Control-Allow-Origin` error.

El backend tiene CORS abierto (`origin: true`) en `app.ts`. Si aparece un error de CORS:
- Verificar que la URL del backend en el frontend apunta al dominio correcto de Railway (sin trailing slash)
- Verificar que Railway no está devolviendo un error antes de que Fastify maneje el request (errores de Railway pueden venir sin headers CORS)

---

## 8. La sesión no se resuelve / retry loop infinito

**Síntoma:** el banner de "conectando al backend" no desaparece, retries cada 15s sin éxito.

El `loadBackendSession` en AppContext reintenta si:
- `status !== 'ready'`
- `session?.onboardingRequired === true`

Pasos:
1. Abrir Network en DevTools → filtrar por `/api/me`
2. Ver qué responde: `{ onboardingRequired: true }` → falta StoreMember; error 500 → ver variables de entorno; timeout → Railway caído

---

## 9. Datos creados pero no aparecen en la UI

**Síntoma:** una operación de create devuelve éxito pero el ítem no aparece en la lista.

Causas:
- El CRUD function en AppContext no hace `setX(prev => [nuevo, ...prev])` después del await
- La operación cayó al fallback de Firestore silenciosamente (ver skill `/harden`)
- El componente está leyendo de un array local en lugar del AppContext

Verificar: en DevTools de React, ver si el estado del contexto cambió después de la operación.

---

## Comandos útiles para debug local

```bash
# Ver estado real de la DB
cd backend && npx prisma studio

# Verificar que el backend levanta correctamente
cd backend && npm run dev

# Verificar TypeScript sin build
npm run lint                        # frontend
npm --prefix backend run lint       # backend

# Ver los logs de Railway desde CLI (si está instalado)
railway logs
```
