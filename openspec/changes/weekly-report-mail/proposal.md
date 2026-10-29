# Reporte por mail #374
Implementar la selección aprobada: mail variante 1 y configuración variante 2. Extender el envío existente con semana cerrada, horario local, HTML/texto y entregas persistentes. No activar proveedores ni infraestructura.

Continuación #374: recuperar el despacho cada cinco minutos dentro de la API, con cierre limpio y el lock existente. Incluir equipos por revisar y acceso al filtro de inventario; documentar todas las variables necesarias sin activar producción.

Corrección #374: usar Resend por HTTPS cuando exista RESEND_API_KEY para evitar el bloqueo de SMTP saliente en Railway Hobby. Mantener SMTP sin esa variable, preservar errores de dominio e idempotencia y corregir la recuperación del formulario sin guardar el borrador al probar. Sin cambiar variables de Railway.
