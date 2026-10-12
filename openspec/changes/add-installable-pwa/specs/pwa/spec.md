## ADDED Requirements

### Requirement: Installable branded application
The app SHALL expose a complete standalone manifest, proposal 3 icons including safe-zone maskable icons, Apple touch icons and portrait/landscape iPhone launch images.

#### Scenario: Launch from Home Screen
- **WHEN** the user installs iManager and opens its icon
- **THEN** it starts at / in standalone mode with the brand colors and safe-area-aware content.

### Requirement: Contextual mobile installation invitation
The app SHALL offer a dismissible installation invitation only in an eligible resolved store session after a delay, and SHALL persist dismissal without repeatedly interrupting the user.

#### Scenario: Safari iPhone
- **WHEN** the signed-in user spends 30 seconds in the app on iPhone Safari
- **THEN** a guide illustrates Compartir → Agregar a inicio and can be dismissed permanently on that browser.

#### Scenario: Android Chrome
- **WHEN** a native beforeinstallprompt is available on a phone
- **THEN** Instalar app triggers that prompt only after a user click.

#### Scenario: Installed or desktop
- **WHEN** the app is already standalone, emits appinstalled, or is used on desktop
- **THEN** no installation invitation is shown.

### Requirement: Static-only service worker
The production service worker SHALL cache only an explicit allowlist of static resources and the application shell, never business API data or authentication responses.

#### Scenario: Offline session resolution
- **WHEN** an installed user opens the cached shell offline
- **THEN** the shell loads and session/API failures remain visible, without cached business responses.

#### Scenario: Application update
- **WHEN** a new release is available while an operation is open
- **THEN** it waits to activate until existing clients close, without forcing a reload or clearing unrelated caches.

### Requirement: Standalone Firebase authentication
The app SHALL use Google redirect with same-origin Firebase helpers in iOS standalone, consume the return result, show redirect errors, and preserve email/password and browser popup login.

#### Scenario: iOS standalone Google login
- **WHEN** the user chooses Google in the installed iPhone app
- **THEN** Firebase starts redirect login through the app-origin helper, and restores the session after returning if the deployed handler is authorized.

#### Scenario: Failed return
- **WHEN** Firebase rejects a redirect result
- **THEN** Login shows an actionable error and remains usable.
