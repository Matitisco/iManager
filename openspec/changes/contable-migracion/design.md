# Diseño

Migración manual aditiva con triggers por tienda, catálogo SQL de estados equivalente al PR A, CHECK NOT VALID y validación posterior. Batches con journal fuera de public y rollback condicionado a valor/timestamp. Sin cambiar schema.prisma ni el arranque automático. Runbook: docs/security/contable-migracion.md.
