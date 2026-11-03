## Approach
Usar Fastify con autenticación de prueba exclusivamente local y Prisma contra una instancia PostgreSQL privada. Mantener resolución real de membresías, validación y transacciones. Verificar ausencia de escrituras y filtraciones con IDs de otra tienda, incluyendo relaciones anidadas.

Los estados de anulación aceptados por una ruta de edición deben exigir el mismo permiso sensible que las rutas de anulación existentes. No rediseñar el catálogo de estados ni los efectos contables de estados históricos sin aprobación de negocio.

## Validation
Test rojo antes de cada fix y verde después; TypeScript frontend/backend y pruebas relacionadas con hasta dos workers. PR contra `test`, CI y merge únicamente con checks verdes.
