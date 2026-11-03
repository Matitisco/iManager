## Why
La CSP completa del host SPA está en Report-Only y no impide cargas no autorizadas.

## What changes
Aplicar CSP en el servidor de HTML, conservar rollback por entorno y validar login, navegación, Firebase, PostHog y PWA con build local.

## Non-goals
Sin cambios de negocio, permisos STAFF, Prisma, migraciones, landing ni producción. Entrega por PR a test; rollout requiere OK de Matias.
