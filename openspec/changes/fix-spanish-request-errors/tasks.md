# Tasks

- [x] Centralizar traducción de red, timeout y 5xx; conservar validaciones 4xx.
- [x] Reemplazar mensajes crudos visibles en desktop y móvil.
- [x] Agregar tests unitarios y regresión del diálogo de eliminar canje.
- [x] Correr lint, build, test, test:e2e y test:pwa:e2e; repetir fallos PWA.

Resultados: lint frontend/backend y build aprobados; 644 unitarios frontend y 143 E2E generales aprobados. PWA: 53 aprobados, 1 flaky aprobado al reintentar y 36 omisiones por plataforma. Los tres fallos iniciales de navegación iPhone también pasaron en una repetición dirigida. El timeout aislado de un test de filtros de inventario desapareció al repetir los unitarios con dos workers. Las seis regresiones PWA nuevas pasan en desktop, iPhone y Android. Sin cambios de Prisma ni commits.
