## Why
En Sales, registrar cada venta exige volver a elegir al vendedor aunque sea el usuario logueado (#749).

## What Changes
- Preseleccionar su miembro en ventas nuevas, únicamente si figura entre los vendedores.
- Conservar cambios manuales, «Sin vendedor», ventas existentes y canjes retomados.

## Non-goals
Sin cambios de persistencia, schema, migraciones, cálculos de dinero ni permisos (#691).

## Impact
Formulario compartido desktop/mobile y respuesta de sesión: exponer el ID de miembro existente.
