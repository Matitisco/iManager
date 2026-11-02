# Dashboard: últimos 7 días por defecto

## Why
El período inicial mensual deja el Dashboard sin actividad el primer día del mes, aunque existan ventas recientes.

## What Changes
- Iniciar el Dashboard desde hoy menos seis días hasta hoy, inclusive, según America/Argentina/Buenos_Aires.
- Compartir el cálculo mediante `dashboardLast7Days()` y ofrecer «Últimos 7 días» en el selector.
- Adaptar vacíos y verificar la comparación con los siete días previos.

## Non-goals
Sin cambios de schema Prisma, API, reportes periódicos ni estilos. Entrega en `feat/dashboard-default-7d` por PR contra `test`, sin tocar main ni producción.

## Impact
Helper, selector, Dashboard y pruebas existentes.
