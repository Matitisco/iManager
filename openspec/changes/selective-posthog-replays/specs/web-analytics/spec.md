## MODIFIED Requirements

### Requirement: Private collection without visible changes
The app SHALL track canonical SPA pageviews and autocapture, mask all inputs and selectively mask monetary values, IMEIs/serials, customer identity/contact data, team emails and import data cells. UI text, labels, buttons and import column headings SHALL remain readable. Replay SHALL preserve element attributes needed by stylesheets. Existing header/body/network exclusions and before_send SHALL remain unchanged, without visible UI changes.

#### Scenario: Readable replay
- **WHEN** UI labels and stylesheet links are recorded
- **THEN** labels and stylesheet attributes remain readable

#### Scenario: Sensitive content
- **WHEN** sensitive values or import data cells are rendered
- **THEN** their text matches the replay masking selector while import column names remain visible
