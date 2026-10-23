## ADDED Requirements

### Requirement: Stable boot and revalidation
The app SHALL retain an opaque static splash until authentication and the destination shell are resolved, and SHALL preserve equal data references on revalidation.

#### Scenario: Firebase confirms cached identity
- **WHEN** Firebase confirms the same uid and profile after a cached boot
- **THEN** session and store list effects SHALL run once and revalidation SHALL retain loaded content

### Requirement: Invisible automatic updates
The app SHALL automatically reload only while hidden and safe, or behind the boot splash after a long absence with a pending update.

#### Scenario: New release during active use
- **WHEN** a release is detected while visible
- **THEN** the app SHALL retain the current screen until hidden or a manual update request

### Requirement: Quiet motion
The app SHALL navigate without page fades, reveal static skeletons after 180 ms, respect reduced motion and keep late notices outside document flow.

#### Scenario: A fast request resolves
- **WHEN** a request completes within 180 ms
- **THEN** its skeleton SHALL never become visible
