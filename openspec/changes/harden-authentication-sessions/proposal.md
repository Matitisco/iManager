# Endurecer autenticación y sesiones

## Why
La API no consulta revocación de Firebase y faltan cuotas en el bridge y rutas costosas. Basic Auth abre el sitio ante una configuración parcial.

## What Changes
Verificar revocación, impedir emulador fuera de tests explícitos, limitar por IP y UID verificado, cerrar Basic Auth mal configurado. Sin schema, migraciones, cambios de permisos ni acceso a producción. Entrega autorizada mediante PR sec/autenticacion hacia test.
