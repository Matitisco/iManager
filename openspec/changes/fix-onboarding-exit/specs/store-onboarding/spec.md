## MODIFIED Requirements

### Requirement: No se puede acceder al core sin contexto de negocio
El frontend SHALL bloquear el acceso a las páginas del core hasta que el usuario tenga un storeMember válido en PG. Una vez creado ese contexto, el paso opcional de stock MUST permitir entrar incluso si falla la sincronización de progreso o una lectura secundaria.

#### Scenario: Acceso directo sin store
- **WHEN** un usuario sin store intenta navegar al core
- **THEN** es redirigido al onboarding para crear contexto de negocio

#### Scenario: Salida de stock con fallo secundario
- **WHEN** un dueño con tienda creada salta el stock o termina una carga persistida y falla el progreso o la recarga de inventario
- **THEN** entra a la app, conserva esa decisión al recargar y reintenta sincronizar el progreso

#### Scenario: Carga de stock fallida
- **WHEN** falla la persistencia de equipos o de ejemplos
- **THEN** se muestra el error sin presentar la carga como exitosa y sigue disponible saltar el paso
