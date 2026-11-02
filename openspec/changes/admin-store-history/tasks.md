- [x] Implementar consulta backend privada a PostHog y proyección segura de BD.
- [x] Unificar acciones, deduplicar, filtrar y paginar; última acción en lotes.
- [x] Historial accesible y última acción en escritorio/móvil.
- [x] Tests de 403, textos, privacidad, filtros/paginación y fallback.
- [x] Lint frontend/backend y tests.
- [x] Commit/push de rama y entrega por PR a test.

Validación: TypeScript frontend/backend; 34 unitarias backend relacionadas, 26 integraciones admin/analítica sobre PostgreSQL local exclusivo (puerto 55431, timezone America/Argentina/Buenos_Aires), 24 pruebas frontend y 2 recorridos Chromium a 1440/390 con APIs interceptadas. Queries HogQL validadas por API real para un ID sintético sin leer eventos de tiendas. Sin build ni cambios en main.
