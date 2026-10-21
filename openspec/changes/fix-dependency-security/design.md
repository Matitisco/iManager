# Diseño

Partir de origin/main 7f4b7ce. Conservar majors cuando sea posible, actualizar locks y reemplazar overrides inseguros solo con compatibilidad verificada. Registrar auditorías completas y de producción, rutas directas/transitivas, excepciones y pruebas. Usar servicios locales de prueba exclusivamente.

Revisión adicional autorizada: override exacto @prisma/config@6.19.3 → deepmerge-ts 8.0.2. Prisma/client permanecen 6.19.3. Validar ciclos del advisory, configuración ordinaria/ausente/inválida, carga TypeScript por c12, generación y suites backend. La nueva semántica de Map no se usa en la configuración actual; revisar el override ante futuros cambios de configuración o Prisma.
