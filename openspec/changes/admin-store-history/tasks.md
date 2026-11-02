- [x] Implementar consulta backend privada a PostHog y proyección segura de BD.
- [x] Unificar acciones, deduplicar, filtrar y paginar; última acción en lotes.
- [x] Historial accesible y última acción en escritorio/móvil.
- [x] Tests de 403, textos, privacidad, filtros/paginación y fallback.
- [x] Lint frontend/backend y tests.
- [x] Commit/push de rama y entrega por PR a test.

Validación: TypeScript frontend/backend; 34 unitarias backend relacionadas, 26 integraciones admin/analítica sobre PostgreSQL local exclusivo (puerto 55431, timezone America/Argentina/Buenos_Aires), 24 pruebas frontend y 2 recorridos Chromium a 1440/390 con APIs interceptadas. Queries HogQL validadas por API real para un ID sintético sin leer eventos de tiendas. Sin build ni cambios en main.

Ajuste de alcance:
- [x] Limitar catálogo, traducir campos y actualizar filtros.
- [x] Consolidar conexiones diarias antes del cursor y entre fuentes.
- [x] Actualizar regresiones, ejecutar lint/tests y pushear al mismo PR.

Validación del ajuste: TypeScript frontend/backend; 56 unitarias backend, 30 integraciones admin/analítica en PostgreSQL nuevo exclusivo (puerto 55432, zona argentina), 24 pruebas frontend y 2 E2E Chromium 1440/390. Ambas queries HogQL, incluidas identidades internas/Firebase, aceptadas por API con tienda sintética inexistente. Sin build ni cambios en main.
