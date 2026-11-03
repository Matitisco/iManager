## ADDED Requirements
### Requirement: Protect browser and operational boundaries
The application SHALL restrict cross-origin reads, prevent framing, hide unexpected internal failures and prevent sensitive operational data from leaving through logs or analytics.
#### Scenario: Hostile origin and private failure
- **WHEN** an untrusted origin requests the API or an unexpected persistence error occurs
- **THEN** no credentialed CORS permission or internal error detail is disclosed.
### Requirement: Clean logout caches
The application SHALL remove persisted business lists on logout even when their index is missing.
#### Scenario: Interrupted cache indexing
- **WHEN** a stored business list has no corresponding list index and the session is cleared
- **THEN** the list is removed while unrelated preferences remain.
