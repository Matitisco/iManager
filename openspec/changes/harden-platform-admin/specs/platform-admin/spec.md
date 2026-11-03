## ADDED Requirements

### Requirement: Autorización admin previa al body
El backend MUST verificar identidad y allowlist antes de parsear bodies admin.

#### Scenario: Request inválido sin privilegios
- **WHEN** un visitante o usuario sin privilegios envía JSON inválido a una ruta admin
- **THEN** recibe 401 o 403 sin procesar el body

### Requirement: Referencias del backup aisladas por tienda
La restauración MUST rechazar referencias de categoría, proveedor o compra ajenas a la tienda confirmada.

#### Scenario: Backup con FK de otra tienda
- **WHEN** un admin restaura un backup que referencia un catálogo de otra tienda
- **THEN** responde 409 y ninguna fila cambia
