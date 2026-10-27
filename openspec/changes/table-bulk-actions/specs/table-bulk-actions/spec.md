## ADDED Requirements

### Requirement: Shared filtered selection
The four tables SHALL support row checkboxes, select-all for every currently filtered row across pages, a selected count and selection scoped to the active user/store.

#### Scenario: Filter or store changes
- **WHEN** selected rows leave the active filter or the store/user changes
- **THEN** hidden rows SHALL leave the selection and no actions SHALL target stale store/user records.

#### Scenario: Desktop selection preserves table semantics and activation
- **WHEN** a user selects records with a row checkbox or its label
- **THEN** the checkbox SHALL expose a record-specific accessible label without including that label in the selection cell's name or opening the record detail.
- **AND** clicking the desktop row or its cells outside the checkbox label SHALL open the record detail without toggling selection, including while selection is active.

### Requirement: Safe actions and partial results
The system SHALL export only selected explicit fields, delete inventory/clients and cancel eligible sales/trade operations using existing endpoints. Destructive actions SHALL require sensitive permissions and confirmation, with existing server audit and business rules.

#### Scenario: A request fails
- **WHEN** an item in a confirmed sequence fails for a business rule or network error
- **THEN** the UI SHALL continue attempting every remaining item, remove only successful rows from selection and announce the attempted/total count through a polite status region.
- **AND** the final sheet SHALL remain open as Resultado with success/failure counts, a Ver detalle disclosure listing every failed name and normalized reason with internal scroll, and a single primary Listo footer button.
- **AND** failures SHALL remain selected for a later retry, selection SHALL unlock when processing ends, and no success toast SHALL appear.
- **AND** Clientes SHALL offer Registrar devolución for the first failure mentioning saldo a favor.

#### Scenario: Every request succeeds
- **WHEN** every item succeeds
- **THEN** the sheet SHALL close and the existing processed-records toast SHALL appear.

#### Scenario: Store/user changes or component unmounts
- **WHEN** the active scope changes or the component unmounts during an in-flight request
- **THEN** the old sequence SHALL stop without starting another request, updating selection or displaying a result/toast.

### Requirement: Mobile selection
Long press SHALL select a card and expose a bottom action bar with safe area padding and accessible touch targets.

#### Scenario: Hold and release
- **WHEN** a user holds a card without scrolling and releases
- **THEN** the card SHALL be selected without opening its detail or menu; a scrolling gesture SHALL cancel the hold.
