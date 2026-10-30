# Open PostHog replays

Matias requests readable text and inputs in iManager recordings. This change supersedes the masking policy in `selective-posthog-replays` for frontend analytics across all modules.

Use `maskAllInputs: false`, omit `maskTextSelector`, and keep `maskInputOptions: { password: true }`. Block payment details and password inputs that can switch to text with the SDK's native `ph-no-capture` class. Preserve existing `data-ph-mask` attributes and all other collection safeguards.

## Non-goals

No project-level PostHog configuration changes (`session_recording_masking_config` is null), backend/Prisma changes, removal of legacy attributes, or visible UI changes. Ordinary business amounts remain readable; payment credentials stay excluded.
