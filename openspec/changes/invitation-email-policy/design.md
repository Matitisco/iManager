## Diseño
El servicio valida auth.email y auth.emailVerified antes de persistir usuario/membresía y vuelve a validar dentro del lock transaccional contra la invitación vigente. No usa User.email de PG ni emails enviados en el body. Los rechazos de identidad comparten 403, código y mensaje genéricos. El preview público conserva metadatos actuales sin email destinatario ni consultas por existencia de cuentas.

El cliente traduce ese código a instrucciones para elegir el email invitado y verificado, ofrece cambio de cuenta sin perder el enlace y envío de verificación para cuentas sin verificar. Aceptar renueva el token para recoger la verificación. /api/me sigue resolviendo por UID y nunca autoacepta invitaciones.

Los enlaces sin email continúan siendo transferibles y de uso único: restringirlos necesita OK de Matias. También requiere OK desplegar el enforcement de email por su efecto sobre usuarios existentes.
