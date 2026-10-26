## ADDED Requirements

### Requirement: Preserve regression coverage across approved layout changes
The E2E suite SHALL exercise the current accessible controls without changing UI, skipping scenarios, increasing timeouts or reducing existing business assertions.

#### Scenario: Seller assignment and commission refresh
- **WHEN** a sale seller is assigned, reloaded and cleared in each currency, trade/deposit and pending variant
- **THEN** the suite verifies persisted seller data and the same expected commission in the current sales panel

#### Scenario: Cancel operation and return from repair history
- **WHEN** a mobile operation form or repair history is dismissed
- **THEN** the suite uses Cancelar or Volver respectively and verifies dismissal, retaining desktop history closure

#### Scenario: Automatic report settings navigation
- **WHEN** the owner opens Reporte automático from settings
- **THEN** the suite verifies the mail settings route, active tab and recipient field
