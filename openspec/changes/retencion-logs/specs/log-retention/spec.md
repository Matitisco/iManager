## ADDED Requirements

### Requirement: Purga conservadora de historial
El backend SHALL purgar únicamente categorías explícitas y conservar registros de negocio, auditoría financiera, categorías desconocidas y claves de deduplicación.

#### Scenario: Seguridad y notificaciones vencidas
- **WHEN** el operador habilita borrado real y existen registros elegibles anteriores al plazo mínimo
- **THEN** se eliminan en lotes limitados, conservando los recientes y las notificaciones sin lectura de algún miembro activo

### Requirement: Operación controlada y auditable
El script SHALL exigir habilitación explícita, simular por defecto, omitir ejecución CLI en test y excluir otras ejecuciones con advisory lock PostgreSQL.

#### Scenario: Dry-run concurrente
- **WHEN** se ejecuta con los defaults o existe otra ejecución con lock
- **THEN** no borra datos y registra estado/conteos sin información personal
