# Tareas

- [x] Generalizar estado rojo y completar listados y filtros.
- [x] Reutilizar modal de motivos y guardar razones en Historial.
- [x] Agregar regresiones de componentes y backend.
- [x] Ejecutar suites frontend/backend y lint sin build.

Validación: 1.275 pruebas frontend (incluidas regresiones de móvil y desktop), 520 unitarias backend, 363 de integración con PostgreSQL local y 15 PWA aprobadas. TypeScript/lint frontend y backend y `git diff --check` aprobados. Sin build, cambios de schema, commit ni push.

Decisión del propietario: unificar Cancelar/Anular.

- [x] Unificar acciones, ReasonSheet y filtros de ventas/canjes.
- [x] Reutilizar reversión integrada y guardar auditoría de anulación atómica.
- [x] Actualizar regresiones unitarias/backend y validar suites y TypeScript sin build.

Validación de la unificación: 1.233 pruebas frontend, 516 unitarias backend y 383 integraciones con PostgreSQL local aprobadas. TypeScript frontend/backend y diff check aprobados. Catorce escenarios E2E existentes aprobados: cuatro comprobaciones de menús y pies de fichas a 390×844 y 1440×900, siete recorridos de operaciones y tres de acciones masivas (WebKit con bibliotecas locales y Xvfb). Se ajustó la expectativa antigua de lista vacía tras archivar para comprobar las filas rojas conservadas en Todos y su paginación. Sin build, cambios de schema, migración de datos, commit ni push.
