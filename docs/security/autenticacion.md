# Seguridad: autenticación, sesiones y rate limiting

Auditoría local del 2026-11-03. Entrega: PR de `sec/autenticacion` hacia `test` (enlace actualizado al abrirlo). Sin producción, datos reales, build, schema ni migraciones; #691 intacto.

| Hallazgo | Severidad | Estado / reproducción y corrección | OK de Matias |
|---|---|---|---|
| Sesiones revocadas / usuarios deshabilitados en Firebase seguían autenticando hasta vencer el ID token | Alta | Arreglado: `verifyIdToken(token, true)`. Regresión local simula la respuesta de Firebase y verifica 401 sin crear usuario PG. | No |
| `FIREBASE_AUTH_EMULATOR_HOST` podía activar el verificador de tokens sin firma fuera de tests | Alta, condicionada a configuración del servidor | Arreglado: arranque rechazado salvo `NODE_ENV=test` + opt-in explícito. No se detectó un bypass remoto por headers. | No |
| Ráfagas sin cuota en bridge, onboarding, invitaciones, análisis/importaciones y reportes | Media | Arreglado: 429 + Retry-After, IP antes de parsing/auth y UID verificado antes de PG/handler. Antes, 121 bridges, 61 previews con tokens distintos, 11 onboardings y 21 aceptaciones/análisis no recibían 429. | No |
| Basic Auth opcional abría el sitio con configuración parcial y permitía adivinación ilimitada | Media | Arreglado: exige ambas credenciales o ninguna; 30 fallos/minuto por IP del socket. Credenciales válidas siguen entrando aunque otro empleado agote fallos desde la misma NAT. | No |
| URL con credencial de invitación en logs HTTP y prefijos de token en logs de negocio | Media | Arreglado: serializer de preview redacta el enlace; se eliminan prefijos y detalles internos de errores sensibles. Prueba captura logs en memoria, sin imprimir enlaces. | No |
| Aceptación devolvía errores internos de proveedor/PG como mensaje público 500 | Baja | Arreglado: mensaje 500 genérico; conserva los errores funcionales 4xx. | No |

## Cuotas y límites de la protección

Ventanas fijas por instancia, máximo 20.000 claves sin guardar tokens/emails ni expulsar cuotas vivas. Los reinicios reinician cuotas; varias réplicas multiplican el cupo. GET/HEAD, variantes con/sin `/`, query strings y tokens renovados comparten cuota. No se limita el CRUD cotidiano del POS.

Por UID: sesión 120/min; onboarding 10/min; invitaciones: preview público 60/IP/min, listado 60/min, crear/revocar 30/min, aceptar 20/min; análisis/aplicar plan 20/min; importaciones 20/min compartidas entre módulos; reportes 60/min; prueba de mail 5/min. Texto IA 20 intentos/10 min por UID, conservando 10 análisis/10 min por tienda y exclusión de análisis concurrentes existentes. El envío de mail conserva además su throttle persistente de un minuto por tienda. IP: 600/min por grupo autenticado, para admitir varios empleados detrás de una NAT. Body global existente de 1 MiB ahora explícito; overrides de importación existentes se conservan.

`TRUST_PROXY_CIDRS` acepta únicamente IP/CIDR explícitos; vacío conserva `trustProxy=false`. Headers XFF/CF/X-Real-IP de conexiones no confiables no cambian la clave. Las pruebas cubren un proxy autorizado con una dirección falsa antepuesta y un caller directo. **La topología real Railway/Cloudflare no fue verificada ni configurada**: hasta definirla, varios usuarios pueden compartir la IP del proxy. No se habilitó trust-all ni se asumió un número de saltos.

## Pendientes que requieren decisión

| Riesgo / decisión | Severidad | Motivo y estado | OK de Matias |
|---|---|---|---|
| Invitación con email acepta otra identidad, incluso sin email verificado | Media | Confirmado local: invitación para qa-sec-21 aceptada por qa-sec-22 con `emailVerified=false`, 200. Actualmente el enlace funciona como credencial transferible, también con email opcional. Vincularlo a email cambia acceso legítimo: pendiente de definir política y recuperación. | Sí, comportamiento |
| `User.status=DISABLED` en PG no bloquea `/api/me` | Media | Confirmado local: usuario sintético DISABLED recibió 200. No hay flujo de gestión de ese estado en el área; no se asume equivalencia con Firebase disabled. Pendiente definir fuente de bloqueo y revisar filas antes de enforcement. | Sí, comportamiento/datos |
| Exigir email verificado para onboarding o toda la app | Política pendiente | Identidad de negocio se vincula por Firebase UID; el acceso de platform admin ya exige email verificado. Requerirlo globalmente necesita UX y recuperación para cuentas existentes. | Sí, comportamiento |
| IP real en Railway/Cloudflare y límites compartidos entre réplicas | Media | Pendiente validar frontera de ingress, configurar CIDRs controlados y decidir almacenamiento compartido/WAF. No se consultaron secretos ni infraestructura de producción. | Sí, configuración/costo |

## Evidencia

Regresiones rojo→verde para revocación, emulador, ráfagas, Basic Auth parcial/fuerza bruta, logs y error 500. PostgreSQL descartable exclusivo `127.0.0.1:28743/autenticacion`, usuarios sintéticos `qa-sec-<n>@example.com`; requests Fastify y HTTP real por loopback. Firebase y proveedor IA se simulan: no se emitieron tokens reales, ni se llamó al proveedor o se revocaron cuentas reales. Audiencia, issuer, firma y vencimiento siguen a cargo del SDK Admin configurado con el proyecto de la credencial; se prueba la traducción uniforme de sus errores a 401. Invitaciones conservan UUID aleatorio, siete días de expiración y consumo único bajo lock/transacción, verificados en tests relacionados.

Validación local: lint TypeScript frontend/backend, 71 unitarios backend, 43 integraciones relacionadas y 5 tests de Basic Auth aprobados; máximo dos procesos de tests con un worker cada uno. Una ejecución ampliada falló por inodos agotados en la máquina compartida; se liberaron recursos exclusivamente de este worktree y las integraciones se repitieron correctamente. CI y número de PR: se actualizan antes de la entrega.

Referencias: [revocación de Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions), [validación de ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [trustProxy de Fastify](https://fastify.dev/docs/latest/Reference/Server/#trustproxy), [headers de Railway](https://docs.railway.com/networking/public-networking/specs-and-limits).
