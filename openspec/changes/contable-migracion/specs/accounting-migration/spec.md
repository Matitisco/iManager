## ADDED Requirements

### Requirement: Aplicación explícita
La migración MUST permanecer separada y requerir OK de Matias para datos/schema.

#### Scenario: PR disponible
- **WHEN** se publica la migración
- **THEN** queda marcada NO MERGEAR sin ejecución automática.

### Requirement: Integridad sin corregir datos por heurística
La migración SHALL proteger nuevas relaciones y reportar históricos inconsistentes; el backfill MUST cambiar sólo alias conocidos.

#### Scenario: Padre ajeno
- **WHEN** una escritura enlaza un padre de otra tienda
- **THEN** se rechaza atómicamente; los datos históricos se reportan para revisión.
