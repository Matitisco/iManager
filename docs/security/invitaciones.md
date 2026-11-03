# Invitaciones: identidad del destinatario

Cambio propuesto en `mejora/invitaciones`, base `test`. Sin producción, datos reales, schema, migraciones ni cambios a #691. Requiere OK de Matias antes de mergear por modificar el acceso de clientes existentes.

## Política elegida

Una invitación **con email** solo puede aceptarse con un token Firebase válido cuyo `email_verified` sea estrictamente `true` y cuyo `email` coincida con el de la invitación tras **trim + lowercase**. Se valida también dentro del lock/transacción que consume el enlace. Mayúsculas y espacios externos se toleran tanto en invitaciones nuevas como históricas, sin modificar filas históricas.

No se quitan `+tags`, puntos ni caracteres internos; tampoco se equiparan dominios, proveedores, aliases ni direcciones que compartan buzón. `persona+equipo@example.com` y `persona@example.com` son identidades distintas para esta política. Un email vacío/malformado histórico no se convierte en enlace libre: si tiene un valor no nulo y no coincide, se rechaza. No se admiten emails vacíos en creación.

La prueba de identidad es el token que verifica Firebase Admin (`verifyIdToken(token, true)`), nunca `User.email` de PostgreSQL, campos del body, nombre visible o pertenencia a Google. No se busca si el email destinatario tiene una cuenta. Un perfil PG puede conservar un email antiguo; eso no autoriza ni bloquea la aceptación si el token vigente dice otra cosa.

## Comportamiento por etapa

- **Crear:** OWNER invita MANAGER/STAFF; MANAGER solo STAFF. El email opcional se valida, normaliza y persiste. No se comprueba existencia de cuentas ni se envía un email de invitación; se comparte un enlace. La UI explica la diferencia entre enlaces con/sin email. Listado y revocación conservan sus permisos actuales.
- **Preview:** público para quien posee el enlace, con tienda, rol, invitador y vencimiento existentes. No expone email destinatario, verificación ni existencia de la cuenta. Conserva estados `valid`, `not_found`, `expired`, `used`, `revoked`; el preview nunca concede acceso.
- **Aceptar:** requiere sesión Firebase. Para invitaciones con email, email distinto/ausente o verificación falsa/ausente reciben exactamente `403` con `{ "error": "No se pudo aceptar la invitación con esta cuenta.", "code": "INVITATION_EMAIL_REQUIRED" }`. No se devuelve el email esperado ni se distingue si hay cuenta. La validación inicial sucede antes de crear/actualizar el usuario PG; no se crea/reactiva membresía, cambia tienda predeterminada ni consume la invitación al rechazar identidad. Se revalida la fila vigente bajo lock antes de mutar membresías.
- **UI de aceptación:** traduce ese código a «Esta invitación es para otro email o tu email todavía no está verificado. Iniciá sesión con el email invitado y verificado.». Muestra solo el email de la cuenta propia, permite «Usar otro email» sin borrar el enlace y ofrece «Enviar verificación de email» a cuentas que Firebase marca sin verificar. El envío se realiza únicamente por acción del usuario al correo de su propia cuenta Firebase; no al destinatario de la invitación. Tras abrir la verificación, se puede volver y aceptar: el cliente fuerza renovación del token antes del POST. Error de persistencia o verificación conserva la pantalla y el enlace; el éxito los limpia. Un cambio de identidad limpia el error de aceptación anterior.
- **Google:** mismo requisito que cualquier proveedor. Una cuenta Google verificada con otro email se rechaza; hay que elegir la cuenta exacta invitada o pedir al responsable un enlace nuevo dirigido al email correcto. No se enlazan ni fusionan cuentas automáticamente.
- **`/api/me`:** conserva identidad por Firebase UID y resuelve membresías ya existentes. No busca ni acepta invitaciones por email; una cuenta sin membresías sigue necesitando onboarding. No se exige email verificado globalmente para la app ni se altera acceso previo a tiendas.
- **Expiración/reuso:** se mantienen siete días de vigencia, revocación y consumo único atómico. Enlace inexistente, expirado, revocado o ya usado responde `410` en aceptación con el mensaje funcional existente. Una carrera de aceptaciones obtiene un solo éxito; las demás reciben `409`/`410` según si ya se detectó la membresía o el consumo. Los errores técnicos conservan el `500` genérico del hardening.

## Enlaces sin email: excepción existente

**Existen y siguen funcionando.** El formulario permite omitir el email y genera links para compartir. `email = null` conserva la autorización por posesión del enlace: cualquier usuario Firebase autenticado puede aceptarlo, incluso sin email verificado, con los límites existentes de roles/cupos, vigencia y uso único. Agregar la exigencia de un email verificado a estos enlaces o bloquearlos rompería un flujo legítimo, por lo que no se cambia en este PR. Conviene usar invitaciones con email cuando se necesita un destinatario exclusivo. Compartir un enlace sin email sigue concediendo acceso a quien lo reciba.

## Alternativas descartadas

- Mantener el email como etiqueta en enlaces con destinatario: permite aceptar a otra identidad y no cumple la política solicitada.
- Comparar con email no verificado: alguien puede registrar una dirección ajena sin probar control del buzón.
- Comparar con el perfil PG o con el body: un perfil desactualizado o un campo controlado por el cliente no prueba identidad actual.
- Normalizar aliases `+tag`, puntos, dominios o aceptar cualquier cuenta Google: equivalencias inseguras y dependientes del proveedor.
- Devolver el email esperado o errores «la cuenta existe/no existe»: añade exposición innecesaria; el preview público no se amplía.
- Bloquear todos los enlaces sin email o exigir verificación global en `/api/me`: cambia flujos existentes fuera del alcance aprobado.
- Cambiar automáticamente email de invitaciones existentes, fusionar cuentas o agregar schema: requiere decisiones/datos/migraciones; no se hace.

## Requiere OK de Matias

1. **Merge/despliegue de esta política para invitaciones con email:** antes eran transferibles aunque tuvieran destinatario; ahora requieren coincidencia y email verificado. Afecta también enlaces pendientes históricos. Quienes usaban otra cuenta deberán cambiarla o pedir revocación y un enlace nuevo. Las cuentas creadas con contraseña deberán verificar el email; se incluye acción de envío y reintento en UI.
2. **Decidir el futuro de los enlaces sin email:** exigir destinatario, mantenerlos o retirarlos, y qué hacer con pendientes. Este PR conserva ese flujo; no implica aprobación para restringirlo.
3. **Operación de verificación Firebase:** validar configuración real de plantillas/action URL y entrega de correo antes de desplegar. En esta tarea se prueban llamadas al SDK y recuperación de UI con mocks; no se envían correos reales ni se consulta configuración de producción.

## Evidencia local

PostgreSQL exclusivo descartable `127.0.0.1:42051/mejora_invitaciones`, datos ficticios; Firebase Admin y correo simulados, sin tokens reales. Solo se aplica el schema existente a esa base con `prisma db push --skip-generate`.

Cobertura: crear/preview/aceptar y `/api/me`, coincidencia y diferencia, verificación falsa y ausente, email ausente, mayúsculas/espacios históricos, `+tag`/puntos/dominios, claims Google atravesando middleware, body manipulado, perfil PG obsoleto, existencia/no existencia de cuenta, revalidación bajo lock, concurrencia, reuso, expiración, revocación y compatibilidad sin email. Frontend: error claro, cambio de cuenta, envío de verificación, error recuperable y renovación de token. No se ejecuta la suite completa local ni build; los checks del PR validan CI.

Validación aprobada: `npm run lint` en raíz y backend (TypeScript), 30 unitarias backend, 52 integraciones relacionadas (43 de invitaciones/permisos/sesión/gestión y 9 de autenticación), 55 frontend. Máximo dos workers de tests simultáneos. Una tanda inicial sufrió timeouts de hooks/arranque de worker y agotó la ventana temporal de un test de cuotas durante saturación del host (load 226); los archivos afectados pasaron al repetir con un worker, sin cambiar tests ajenos ni timeouts.
