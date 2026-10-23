## ADDED Requirements

### Requirement: Agrupaciones visibles sin selector
Patrones MUST mostrar Proveedor, Compra y Modelo como secciones apiladas sin pastillas selectoras, usando componentes y tokens existentes.

#### Scenario: Consultar las tres agrupaciones
- **WHEN** un usuario autorizado abre Patrones
- **THEN** las tres secciones muestran sus datos o el vacío existente, con detalles accesibles en desktop y móvil

#### Scenario: Abrir desde un enlace de proveedor
- **WHEN** el enlace incluye una agrupación y registro
- **THEN** se selecciona ese registro solamente en su sección y las otras siguen disponibles

#### Scenario: Cambiar de contexto de negocio
- **WHEN** cambia la tienda, identidad o permisos
- **THEN** ninguna sección reutiliza datos ni respuestas pendientes del contexto anterior
