# Diseño

Usar el middleware existente y storeId resuelto de membresías activas. Conservar invitaciones sin email como enlaces de un uso. El email es una etiqueta por decisión explícita de #71: documentar el riesgo sin cambiar esa política. MANAGER solo debe recibir enlaces que pueda emitir (STAFF). Al reincorporar un miembro, reemplazar sus permisos por los de la invitación actual, sin heredar acceso sensible anterior. Regresiones con Fastify y PostgreSQL local exclusivo, datos sintéticos y auth bypass limitado a NODE_ENV=test. Inventario de rutas y pendientes en docs/security.
