## Decisions
La tienda se toma exclusivamente de la sesión. Validar lecturas y escrituras con requests Fastify y persistencia real en PostgreSQL descartable, usuarios qa-sec-<n>@example.com. No usar servicios externos.

El permiso sensible existente para cambiar precio/costo también protege la denominación monetaria de esos valores. Mantener lectura financiera de STAFF (#691), altas, cambios no financieros y permisos explícitos. La reimportación de costos por STAFF ya está cubierta como comportamiento esperado: documentarla para decisión de Matias antes de modificarla.

## Validation
Regresión roja/verde para moneda; matriz multi-tienda y permisos. TypeScript frontend/backend y tests relacionados, máximo dos workers, sin build ni suite completa.

La prueba relacionada de compras aún esperaba anular un reclamo compensado pese a #717. Cuatro casos fallan igual contra el código base sin este fix. Actualizar solo su expectativa a 409 y comprobar que el reclamo sigue activo, conservando adquisición, inversión y reventa.
