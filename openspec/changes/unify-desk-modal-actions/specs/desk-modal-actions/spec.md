## ADDED Requirements

### Requirement: Modal focus ownership
Sheet and Dialog SHALL place focus inside the active modal, contain keyboard and
programmatic focus there, and restore connected trigger focus when dismissed.

#### Scenario: Modal opens and closes
- **WHEN** a Sheet or Dialog opens from a focused trigger
- **THEN** focus enters its surface, Tab and Shift+Tab stay inside, and closing restores the trigger

#### Scenario: Nested or portaled modal
- **WHEN** a child modal opens above its parent
- **THEN** only the child contains focus; closing it restores focus inside the parent
- **THEN** closing an entire modal branch restores a surviving outer trigger

#### Scenario: Existing camera overlay above a sheet
- **WHEN** a caller Sheet opens the existing scanner or its permission surface
- **THEN** focus stays in that surface and Escape closes it before its caller
- **THEN** the form and its draft remain available without changing camera acquisition or decoding

### Requirement: Single-layer dismissal and pending persistence
Only the top modal layer SHALL consume user dismissal. Busy SHALL block Escape,
backdrop and close-button dismissal without changing persistence behavior.

#### Scenario: Pending expense save
- **WHEN** Nuevo gasto is waiting for persistence and the user presses Escape or clicks the backdrop or close button
- **THEN** the form remains mounted and no second operation is started
- **WHEN** persistence fails
- **THEN** the form and values remain open with an error, without a success announcement

#### Scenario: Nested confirmation or selector
- **WHEN** Escape is pressed with a child confirmation, selector or state editor open
- **THEN** only that child closes, and a busy child prevents dismissal of its parent

### Requirement: Shared layout and action hierarchy
Sheet SHALL use a persistent header/close, internally scrolling body and
non-shrinking footer. The seven #447 flows SHALL show at most one primary
action per state and keep every previously permitted action reachable, with
the same authorization condition, callback, confirmation and financial
behavior.

#### Scenario: Constrained viewport
- **WHEN** rules, expense, sale, trade-in, equipment, client or repair UI opens at 1440x900, 1536x640, 390x844 or 320px wide
- **THEN** close and footer controls remain fully reachable before and after body scroll, with no horizontal clipping or bottom-navigation obstruction
- **THEN** the final field remains readable and actionable, and secondary/destructive actions remain discoverable

#### Scenario: Secondary action disclosure
- **WHEN** a footer or saved rule has secondary actions
- **THEN** a keyboard-operable disclosure exposes every allowed action with a labelled group and a target at least 44px high
- **WHEN** Escape is pressed while the disclosure is open
- **THEN** only the disclosure closes and focus returns to its summary
- **THEN** a disclosure in the scrolling body expands without clipping its actions

#### Scenario: Busy modal action
- **WHEN** a migrated sheet is saving
- **THEN** its X, backdrop and Escape dismissal remain blocked, and its form actions remain disabled
- **WHEN** persistence succeeds
- **THEN** existing programmatic close behavior continues
