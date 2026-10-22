## MODIFIED Requirements

### Requirement: Supplier navigation belongs to Finance
The system SHALL show Proveedores in Finanzas beside Gastos on desktop, mobile Más and page chips for visible roles, preserving inventory-based authorization. STAFF SHALL NOT see Finanzas on any navigation surface.

#### Scenario: Inventory-only employee
- **WHEN** an employee has inventory access
- **THEN** Finanzas is absent from sidebar, Más and chips, while authorized direct supplier routes remain accessible

#### Scenario: Existing supplier link
- **WHEN** an authorized user opens `#/stock/proveedores` with a query string
- **THEN** the app opens Proveedores at `#/finanzas/proveedores` and preserves that query
