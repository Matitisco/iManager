- [x] Retirar ambos bloques inline y sus estilos sin uso.
- [x] Integrar eventos antiguos sin duplicar auditoría y traducir estados.
- [x] Agregar pruebas unitarias/componentes y ejecutar src/desk, backend relevante y ambos typechecks.
- [x] Revisar diff.
- [ ] Crear commit en español sin push.

Validación: `npx vitest run src/desk --maxWorkers=2`, 17 pruebas unitarias backend de auditoría/reparaciones, 11 integraciones PostgreSQL de reparaciones/historial/archivo y ambos `npm run lint`. La pasada sin limitar workers tuvo un timeout en Inventario; se repitió toda la suite con dos workers. Sin E2E nuevos ni build.

Commit bloqueado por el entorno: `git add` no puede crear `/workspace/imanager-local/.git/worktrees/wt-historial/index.lock` porque ese directorio está montado como solo lectura. No se hizo push.
