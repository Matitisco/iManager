## ADDED Requirements

### Requirement: CSP del host HTML
El servidor SPA MUST emitir Content-Security-Policy completa por defecto, incluyendo los orígenes configurados de API, Firebase y PostHog, hashes del bootstrap, estilos inline y workers PWA/replay.

#### Scenario: Modo normal
- **WHEN** se solicita el HTML sin CSP_REPORT_ONLY=true
- **THEN** las directivas de recursos se aplican en enforcing sin permitir scripts inline arbitrarios ni eval.

#### Scenario: Rollback
- **WHEN** CSP_REPORT_ONLY=true al iniciar el servidor
- **THEN** se emite la política completa en Report-Only y se conservan base-uri, object-src y frame-ancestors en enforcing.
