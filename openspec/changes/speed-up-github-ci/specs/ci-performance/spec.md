## ADDED Requirements

### Requirement: Fast CI preserves checks

The workflow SHALL retain existing TypeScript and test checks, use GitHub-hosted runners, and run complete suites on pushes to main and test.

#### Scenario: Push to a protected integration branch

- **WHEN** a push targets main or test
- **THEN** full frontend, backend unit, backend integration, E2E and PWA suites run independently of affected-file selection

### Requirement: Evidence precedes optimization

CI changes MUST include a timestamp-based baseline and an after report distinguishing queue, setup and execution per job.

#### Scenario: Review performance changes

- **WHEN** the PR is reviewed
- **THEN** the report includes the last approximately 30 baseline runs, measured after runs and explicit failure/coverage limitations

### Requirement: Safe test runtime tuning

Any applied Vitest pool or isolation optimization MUST pass three complete runs and improve measured runtime.

#### Scenario: Candidate is unstable

- **WHEN** a pool or isolation candidate fails or is slower
- **THEN** it is not applied
