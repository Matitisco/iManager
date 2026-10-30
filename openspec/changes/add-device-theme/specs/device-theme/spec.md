## ADDED Requirements

### Requirement: Tema por dispositivo
El sistema SHALL ofrecer Claro, Oscuro y Automático en Configuración y guardar la preferencia en localStorage, sin persistirla en el negocio.

#### Scenario: Inicio automático
- **WHEN** no hay preferencia válida
- **THEN** el tema sigue al sistema desde antes del primer render, incluidos sus cambios posteriores y la meta theme-color

#### Scenario: Elección explícita
- **WHEN** se elige Claro u Oscuro
- **THEN** el tema cambia inmediatamente, persiste en el dispositivo y no cambia con el sistema

### Requirement: Cobertura visual
El sistema SHALL adaptar las superficies y controles de la app, con texto legible, conservando el modo claro y la impresión.

#### Scenario: Comprobantes
- **WHEN** se imprime o comparte un comprobante desde modo oscuro
- **THEN** la salida conserva la paleta clara
