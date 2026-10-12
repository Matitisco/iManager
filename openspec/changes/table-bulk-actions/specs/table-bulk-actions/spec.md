## ADDED Requirements

### Requirement: Shared filtered selection
The four tables SHALL support row checkboxes, select-all for every currently filtered row across pages, a selected count and selection scoped to the active user/store.

#### Scenario: Filter or store changes
- **WHEN** selected rows leave the active filter or the store/user changes
- **THEN** hidden rows SHALL leave the selection and no actions SHALL target stale store/user records.

### Requirement: Safe actions and partial results
The system SHALL export only selected explicit fields, delete inventory/clients and cancel eligible sales/trade operations using existing endpoints. Destructive actions SHALL require sensitive permissions and confirmation, with existing server audit and business rules.

#### Scenario: A request fails
- **WHEN** a confirmed sequence fails after successful requests
- **THEN** the UI SHALL report completed/pending counts, preserve pending selection, stop further requests and remain open without reporting full success.

### Requirement: Mobile selection
Long press SHALL select a card and expose a bottom action bar with safe area padding and accessible touch targets.

#### Scenario: Hold and release
- **WHEN** a user holds a card without scrolling and releases
- **THEN** the card SHALL be selected without opening its detail or menu; a scrolling gesture SHALL cancel the hold.
