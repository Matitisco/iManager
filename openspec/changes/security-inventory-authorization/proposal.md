## Why
Auditar autorización multi-tienda de inventario, compras y sus relaciones sin tocar producción ni alterar permisos legítimos.

## What Changes
- Probar IDOR, relaciones ajenas, arrays mixtos, IMEI, mass assignment y permisos con dos tiendas ficticias en PostgreSQL local.
- Cerrar únicamente bypasses confirmados y acotados de permisos existentes.
- Documentar inconsistencias que requieren decisión de negocio; conservar #691.

## Impact
Backend de inventario, regresiones HTTP y docs/security/idor-inventario.md. Sin schema ni migraciones. Entrega por PR hacia test.
