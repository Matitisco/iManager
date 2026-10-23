# Sidenav con acordeón exclusivo

## Why

Matias aprobó el prototipo el 23/10/2026. Se incorpora al shell real: Comercial, Stock, Atención, Finanzas, Análisis y Cuenta exponen sus destinos dentro del menú y permiten cero o un grupo abierto. Se retiran las islitas de navegación de las pantallas, también en Más móvil.

## What Changes

Conservar permisos, módulos ocultos, contadores, barra inferior, rutas e historial. Reclamos/Patrones y Resumen/Equipos de Catálogo móvil pasan al menú. Resumen periódico conserva su ruta propia incorporada en main por #534. Los filtros de registros, tipos de reporte y agrupaciones siguen disponibles en cada pantalla.

Sin cambios de backend, API, Prisma, AppContext ni dependencias. Sin drawer o modo compacto nuevos. Validación con datos falsos locales, publicación mediante PR y CI verde; sin operaciones directas sobre producción ni sus bases.
