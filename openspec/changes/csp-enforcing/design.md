El host Node de la SPA emite la política efectiva; la CSP independiente de la API sigue restrictiva. Los orígenes públicos se guardan al compilar y los scripts inline del shell confiable reciben hashes SHA-256. No usar unsafe-inline/unsafe-eval en script-src. Conservar estilos inline y workers blob. Helpers Firebase mantienen su política separada para no romper el proxy de autenticación.

CSP_REPORT_ONLY=true deja las restricciones base activas y mueve las directivas completas a Report-Only. Validar primero esa modalidad y después enforcing sobre el mismo build, con PostgreSQL local exclusivo y máximo dos workers.

La validación del SDK real detectó que el filtro de #727 quita el identificador público del proyecto requerido por la ingestión. Restaurar únicamente el valor público configurado después de filtrar PII/tokens de identidad; comprobar pageview/snapshot y replay contra interceptores locales.
