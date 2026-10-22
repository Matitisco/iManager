## Tasks

- [x] Quitar subtítulos de encabezados compartidos y propios y cálculos exclusivos.
- [x] Actualizar tests de componentes y selectores E2E afectados.
- [x] Ejecutar Vitest, TypeScript y lint; revisar diff.

## Validation

- Suite desk: 117 archivos aprobados; el único fallo fue una expectativa del subtítulo de permisos de miembro, corregida y verificada al repetir `AccountScreens.test.tsx` (16/16). Total: 967 pruebas verificadas.
- `npx tsc --noEmit`, `npm run lint` y `npm --prefix backend run lint` aprobados.
- Títulos, acciones y navegación de los encabezados, y 18 encabezados de sheets comparados contra HEAD sin cambios de contenido.
- Selectores E2E existentes actualizados; sin pruebas E2E nuevas ni ejecución contra producción.
- Commit solicitado: `fix: quitar subtítulos de las secciones`. Bloqueado por metadatos Git de solo lectura: no se pudo crear `/workspace/iManager/.git/worktrees/wt-subtitulos/index.lock`. Sin push.
