## ADDED Requirements
### Requirement: Related PR test selection
CI SHALL select related frontend and backend tests from the complete PR diff and run lint/TypeScript on every PR.
#### Scenario: UI change
- **WHEN** a PR modifies frontend source
- **THEN** run related frontend tests, filesystem regressions and browser smoke, without unrelated backend tests.
#### Scenario: Backend change
- **WHEN** a PR modifies only backend source
- **THEN** run related backend tests and frontend dependents, without browser smoke.
#### Scenario: Global changes and deleted sources
- **WHEN** dependencies, configuration or deleted sources invalidate dependency selection
- **THEN** run complete affected suites.
#### Scenario: Documentation
- **WHEN** a PR only changes documentation
- **THEN** run lint and let test succeed with test suites skipped.
### Requirement: Preserve full validation and required check
CI SHALL preserve complete main/nightly validation and required check test.
#### Scenario: Full run
- **WHEN** the event is push to main, schedule or workflow_dispatch
- **THEN** run all existing suites and shards.
#### Scenario: Skipped work
- **WHEN** optional suites are skipped and all selected jobs succeed
- **THEN** test succeeds.
#### Scenario: Failure
- **WHEN** detection or any selected job fails or is cancelled
- **THEN** test fails.
