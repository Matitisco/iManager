## ADDED Requirements

### Requirement: Guarded activity views
The panel SHALL show Tiendas, Embudo and per-store timelines at the approved URLs and SHALL fetch no admin data for denied capability checks.

#### Scenario: Non-admin visits a panel route
- **WHEN** the capability probe denies access
- **THEN** the existing not-found view is displayed and no admin data is fetched

### Requirement: Funnel and store cohorts
The panel SHALL share 7d, 30d and all filters, display the approved metrics, clamp drops at zero and highlight only one largest drop. Store views SHALL replace billing columns with stuckAt and active days.

#### Scenario: Non-sequential milestone increases
- **WHEN** a milestone count equals or exceeds its predecessor
- **THEN** its drop line reads «sin abandono»

### Requirement: Store timeline
The panel SHALL show twelve milestone indicators and translated events grouped by Argentine day, newest first, with consecutive active entries collapsed and negative events in amber.

#### Scenario: Repeated activity
- **WHEN** consecutive active_day events occur on one Argentine day
- **THEN** one compact entry displays their device labels
