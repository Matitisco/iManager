## Context
El guard existente protege todos los recursos antes de servirlos o proxyearlos. Ambas variables ausentes deshabilitan el gate; configuración parcial falla cerrado.

## Decisions
Conservar createBasicAuthGuard exportado: boolean sincrónico salvo POST del formulario; createSpaHandler espera ambos. GET /__login responde 200; las navegaciones HTML bloqueadas responden 401. Otros recursos reciben 401 plano sin desafío Basic. Ninguna respuesta del login o redirect se cachea.

Cookie HttpOnly, Secure, SameSite=Lax, Path=/ por 30 días: JSON exp en milisegundos, base64url y HMAC-SHA256 con clave derivada de usuario y contraseña. Firma y credenciales se comparan con timingSafeEqual; reloj inyectable. POST urlencoded hasta 8 KB, next interno saneado y HTML escapado, sin scripts. Fallos comparten el límite existente de 30/min por IP de socket; credenciales válidas pueden entrar aun con cuota agotada.

## Risks
La cookie requiere HTTPS. Cambiar las credenciales invalida sesiones. El gate es independiente de la sesión Firebase del negocio. Rutas reservadas no caen al SPA incluso con gate deshabilitado.

## Validation
Solo node --test de scripts/basic-auth.test.mjs, scripts/http-security.test.mjs y scripts/pwa.test.mjs. PR y squash exclusivamente contra test tras checks verdes.
