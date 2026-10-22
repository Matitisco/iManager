## Decisions

Eliminar la prop `subtitle` de los consumidores de `PageHead` y `ScreenTitle` y retirar su renderizado y tipado compartidos. Quitar también los subtítulos de los encabezados propios de Control de stock y Más. No modificar `Sheet` ni los textos secundarios del contenido o de navegación.

Eliminar solo cálculos/imports exclusivos de los subtítulos. Mantener consultas y datos utilizados por las tablas, filtros, pestañas y acciones.

## Validation

Actualizar assertions afectadas y usar títulos o elementos estables en E2E existentes. Ejecutar Vitest relevante, `npx tsc --noEmit` y lint frontend/backend, sin build ni push.
