## MODIFIED Requirements

### Requirement: Private collection without visible changes
The app SHALL track canonical SPA pageviews and autocapture with readable UI text and ordinary inputs. Replay SHALL use `maskAllInputs: false`, omit `maskTextSelector`, and set `maskInputOptions: { password: true }`. Passwords that can be displayed as text and payment details SHALL carry the native `ph-no-capture` class. Existing `data-ph-mask` attributes SHALL remain without acting as masking selectors. Stylesheet attributes, header/body/network exclusions, `before_send`, and all other analytics options SHALL remain unchanged, without visible UI changes. This policy supersedes `selective-posthog-replays`.

#### Scenario: Readable workflows
- **WHEN** UI text, import data, business amounts and ordinary inputs are recorded
- **THEN** their content remains readable, including elements with legacy `data-ph-mask` attributes

#### Scenario: Password protection
- **WHEN** login, registration, reset or account passwords are entered
- **THEN** password input masking or native blocking excludes their values, including when a visibility toggle changes the input to text

#### Scenario: Payment protection
- **WHEN** billing payer details are displayed or edited
- **THEN** the details are blocked by `ph-no-capture` without a custom text selector
