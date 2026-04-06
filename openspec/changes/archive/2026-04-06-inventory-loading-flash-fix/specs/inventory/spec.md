## ADDED Requirements

### Requirement: Ocultar conteo durante carga inicial
El sistema SHALL mostrar indicadores de carga en lugar del conteo "0" mientras los datos de inventario están en vuelo (carga inicial o cambio de categoría). El badge de conteo en el header SHALL mostrar un skeleton animado y el footer SHALL mostrar "Cargando..." hasta que el fetch resuelva.

#### Scenario: Badge durante carga inicial
- **WHEN** el módulo Inventario monta por primera vez y el fetch aún no resolvió
- **THEN** el badge del header muestra un skeleton animado en lugar de "0"

#### Scenario: Badge durante cambio de categoría
- **WHEN** el usuario cambia de categoría y el nuevo fetch aún no resolvió
- **THEN** el badge del header muestra un skeleton animado en lugar del conteo anterior o "0"

#### Scenario: Footer durante carga
- **WHEN** `isInitialLoading` es `true`
- **THEN** el footer muestra "Cargando..." en lugar de "Mostrando 0 de 0"

#### Scenario: Restaurar conteo real
- **WHEN** el fetch de inventario resuelve exitosamente
- **THEN** el badge muestra el total real y el footer muestra "Mostrando N de M"
