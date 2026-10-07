## ADDED Requirements

### Requirement: Use a themed custom date calendar
Reports date controls SHALL show a calendar matching desk typography, colors, rounded corners and shadows, with manual date entry, month/year navigation and Today/Clear actions. Selecting a date SHALL update only the draft range until the user applies the period.

#### Scenario: Select a date from the popup
- **WHEN** the user opens the calendar and selects a day
- **THEN** the field shows the selected local date, the popup closes, focus returns to the date field and the applied report remains unchanged

#### Scenario: Navigate without a pointer
- **WHEN** the user opens the calendar with the keyboard
- **THEN** arrow keys navigate days, PageUp/PageDown navigate months, and Escape closes the popup and restores field focus

#### Scenario: Dismiss or position the popup
- **WHEN** the user interacts outside the popup or opens it near a viewport edge
- **THEN** outside interaction dismisses it and its placement stays inside the viewport

#### Scenario: Enter dates manually
- **WHEN** the user types a date using dd/mm/yyyy
- **THEN** the existing report validation and inclusive local date boundaries remain in effect
