## ADDED Requirements

### Requirement: Quiet connection failures
The frontend SHALL suppress connection banners, connection messages and empty states caused by network load failures.

#### Scenario: A load fails offline
- **WHEN** a frontend data load fails because of connectivity
- **THEN** no connection text, banner or replacement empty-state message is rendered
- **AND** existing reconnect and retry behavior continues

### Requirement: Neutral action failures
The frontend SHALL retain visible failure feedback for user actions using neutral copy for network failures.

#### Scenario: An action fails offline
- **WHEN** login, reset, save or payment fails due to connectivity
- **THEN** the action remains unsuccessful and displays neutral failure copy without connection wording
