## ADDED Requirements

### Requirement: Operation fields have independent space
Sale creation and trade creation/editing SHALL place fields and their validation messages in normal layout flow, with separate space for camera controls and suggestions.

#### Scenario: Desktop rows and phone stack
- **WHEN** a sale or trade form opens at 1440px or 390px, empty, filled or with validation errors
- **THEN** fields SHALL remain within the body without intersecting, with desktop columns aligned and phone rows stacked

#### Scenario: Open selectors and scanner
- **WHEN** client/equipment suggestions, the date calendar, seller selector or scanner are open
- **THEN** controls SHALL remain usable within the viewport and closing the overlay SHALL preserve the form and its values

### Requirement: Only the operation body scrolls
The form SHALL use a scrolling body with a stationary header and action footer.

#### Scenario: Reach the last field
- **WHEN** the user scrolls to the bottom of a long operation form
- **THEN** the last field SHALL be reachable above the footer and header/actions SHALL retain their position
