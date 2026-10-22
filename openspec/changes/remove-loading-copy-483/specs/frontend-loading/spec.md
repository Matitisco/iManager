## ADDED Requirements

### Requirement: Quiet loading states
The frontend MUST show content-shaped skeletons or no content during loading, without visible Cargando or Loading messages.

#### Scenario: Pending screen or modal
- **WHEN** a frontend request is pending
- **THEN** its loading region shows subtle placeholders with an accessible busy state
- **AND** loaded content, errors and navigation retain their existing behavior

#### Scenario: Regression prevention
- **WHEN** visible loading copy is introduced in frontend TSX
- **THEN** the source regression test fails
