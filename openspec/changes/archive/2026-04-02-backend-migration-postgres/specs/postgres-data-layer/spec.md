## ADDED Requirements

### Requirement: PostgreSQL es la única fuente de verdad del negocio
El sistema SHALL usar PostgreSQL (via Prisma) como única fuente de datos para los módulos migrados. No SHALL existir fallback silencioso a Firestore: si el backend falla, el error es visible al usuario.

#### Scenario: Backend disponible
- **WHEN** el frontend hace una operación CRUD en un módulo migrado y el backend responde correctamente
- **THEN** la operación se persiste en PG y se refleja en la UI

#### Scenario: Backend no disponible
- **WHEN** el frontend intenta una operación y el backend no responde (timeout o error)
- **THEN** la UI muestra un mensaje de error visible; NO se realiza ninguna escritura a Firestore

### Requirement: Schema Prisma sincronizado en cada deploy
El backend SHALL ejecutar `prisma db push` al arrancar en Railway para sincronizar el schema con la base de datos. Esto garantiza que los nuevos campos y modelos estén disponibles sin intervención manual.

#### Scenario: Deploy con schema actualizado
- **WHEN** Railway despliega una nueva versión del backend con cambios en `schema.prisma`
- **THEN** `prisma db push` aplica los cambios al iniciar; el servidor arranca con el schema correcto
