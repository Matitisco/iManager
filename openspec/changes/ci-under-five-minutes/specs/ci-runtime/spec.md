## ADDED Requirements

### Requirement: Browser jobs avoid runtime OS package installation
The CI workflow SHALL run browser jobs using a Playwright image matching the
locked package version, without installing browser system packages during jobs.

#### Scenario: Browser jobs start on a fresh runner
- **WHEN** a frontend, PWA or E2E job starts without cached browser files
- **THEN** its container already provides the required browsers and OS libraries
- **AND** every test selected by the existing PR or full-suite policy still runs

### Requirement: Required dependency installation is performed once per project
Each job SHALL install each required npm project once and cache downloads using
the lockfiles for the projects it uses.

#### Scenario: A test job imports frontend and backend modules
- **WHEN** dependencies are prepared
- **THEN** both projects are installed once in parallel with failures propagated

### Requirement: PR runs retain existing coverage and cancellation
The workflow SHALL target successful PR completion under five minutes without
removing tests or changing their assertions, selection rules or concurrency
cancellation behavior.

#### Scenario: Backend integration tests share database cleanup
- **WHEN** the integration suite runs
- **THEN** its files remain serial to preserve shared database isolation
