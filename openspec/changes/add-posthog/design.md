# Design

Use an isolated, exception-safe PostHog adapter with environment guards and typed, runtime-filtered properties. Initialize before React. Track canonical SPA sections manually so query strings, invitation tokens and record IDs never become analytics URLs. Use the existing session context for identity and successful service responses for business events.

Mask all replay text and inputs, omit DOM attributes from autocapture, disable network/console recording and all SDK features that could introduce UI. Detect the first observed addition after a successful empty inventory read; persist its marker per store in this browser. This is a browser milestone, not an authoritative cross-device database fact.

Use related frontend/service tests, backend analytics unit regressions and an isolated mocked browser check without database access. Keep feat/posthog and open a labeled PR without merging, as explicitly requested.
