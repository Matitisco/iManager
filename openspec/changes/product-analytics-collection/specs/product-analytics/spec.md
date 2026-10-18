## ADDED Requirements

### Requirement: Private first-party collection
The system SHALL collect only allowlisted events with internal session IDs and sanitized props, without affecting domain operations.

#### Scenario: Invalid or failed tracking
- **WHEN** tracking fails or props contain private text
- **THEN** the business operation succeeds and private props are discarded

### Requirement: Admin analytics JSON
The system SHALL provide a historical funnel and bounded chronological timeline only to platform admins with a verified Firebase email in ADMIN_EMAILS.

#### Scenario: Historical store
- **WHEN** a store predates collection
- **THEN** existing domain tables provide derived milestones

### Requirement: Verified admin capability and denied access
The system SHALL return 401 without a valid session and 403 Forbidden for authenticated non-admins, including allowlisted unverified emails, on all admin endpoints and the capability probe.

#### Scenario: Denied panel access
- **WHEN** the capability probe denies access or the activity API returns 403/404
- **THEN** the frontend shows its existing not-found state and does not expose activity data
