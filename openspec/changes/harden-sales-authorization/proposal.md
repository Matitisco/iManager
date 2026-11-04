## Why
Auditar autorización multi-tienda en Ventas, Canjes, pagos, cuenta corriente y comisiones con PostgreSQL local descartable. Comprobar que las rutas alternativas respeten los permisos de acciones sensibles.

## What Changes
- Regresiones HTTP con membresías OWNER/STAFF y dos tiendas ficticias.
- Correcciones mínimas para vulnerabilidades reproducidas; pendientes documentados en `docs/security/idor-ventas.md`.

## Non-goals
Sin producción, migraciones, cambios de schema, restricciones de costos/ganancia de #691 ni cambios de reglas financieras.
