## Frontend
- [x] Generar mockup previo desktop/mobile.
- [x] Reproducir duplicación en Vitest (cinco regresiones fallaban antes del fix).
- [x] Unificar opciones preservando selección y valor original.
- [x] Validar unitarias, componente e integración, TypeScript y capturas.

## Backend
Sin cambios.

## Revalidación #483.5 (2026-10-23)
- [x] Confirmar que #492 ya está mergeada en main y verificar la app con PostgreSQL falso en API 3370 / web 4370.
- [x] Ampliar regresión de edición histórica y catálogo demorado (GB/TB, espacios, mayúsculas y espacio no separable).
- [x] Demostrar que los cuatro escenarios nuevos fallan sin deduplicación y pasan con el arreglo existente.
- [x] Registrar antes reconstruido/después y flujo crítico con persistencia en 1440×900 y 390×844; detalle en `docs/qa-483/almacenamiento.md`.
