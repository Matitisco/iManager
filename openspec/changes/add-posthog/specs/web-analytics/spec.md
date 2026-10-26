## ADDED Requirements

### Requirement: Guarded collection
The web app SHALL collect PostHog events in the US only outside development, test and automation, with a nonempty project key. Analytics SHALL never throw into product flows.

#### Scenario: Disabled runtime
- **WHEN** development, Vitest, test mode, webdriver, E2E flags or an empty key is present
- **THEN** initialization, capture, identify and reset are no-ops

### Requirement: Minimal identity and successful funnel events
The app SHALL identify with internal user/store IDs and role, reset on logout, and emit the requested signup, onboarding, inventory, import, operation and invitation events only at their corresponding completed actions.

#### Scenario: Failed persistence
- **WHEN** a business write fails
- **THEN** no success event is emitted; failed imports include only a row count

### Requirement: Private collection without visible changes
The app SHALL track canonical SPA pageviews and autocapture while masking replay text, inputs and sensitive attributes and excluding personal data, amounts, record IDs and tokens from event properties and URLs. It SHALL introduce no UI.

#### Scenario: Sensitive content
- **WHEN** customer data or an amount is rendered
- **THEN** replay masks its text and inputs, and autocapture omits text and attributes
