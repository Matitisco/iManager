## ADDED Requirements

### Requirement: Supplier navigation belongs to Finance
The system SHALL show Proveedores in Finanzas beside Gastos on desktop, mobile Más and page chips, preserving inventory-based authorization.

#### Scenario: Inventory-only employee
- **WHEN** an employee has inventory access but no cash or expense access
- **THEN** Finanzas contains Proveedores and does not expose Cajas or Gastos

#### Scenario: Existing supplier link
- **WHEN** an authorized user opens `#/stock/proveedores` with a query string
- **THEN** the app opens Proveedores at `#/finanzas/proveedores` and preserves that query

### Requirement: Every bottom navigation button has a visible label
The mobile bar SHALL show the icon and full label for every available button, keep the active state discernible and fit a 320px viewport with touch targets at least 44px wide and high.

#### Scenario: Five navigation buttons on a narrow phone
- **WHEN** the bar contains Dashboard, Ventas, Equipos, Clientes and Más at 320px
- **THEN** all labels remain visible without horizontal overflow before and after switching sections
