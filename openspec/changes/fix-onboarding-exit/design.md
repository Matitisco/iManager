## Context
Store and OWNER membership are persisted in step 1. StockFlow.finish currently awaits optional progress PATCH, inventory GET and session GET; OnboardingJourney has a no-op finish callback. A failed optional request prevents exit.

## Decisions
Keep an explicit stock-exit preference in the existing getting-started state, scoped by auth uid and store id. Store it locally for reload recovery, and synchronize the idempotent completion PATCH on entry, focus and reconnect. App's stock-stage guard uses that preference, while store/auth guards remain mandatory. Route before leaving; refresh inventory in the background with a handled error. Sample creation and stock imports must succeed before exit.

## Risks
Storage may be unavailable; memory still permits the current exit. Local exit is a navigation preference, never proof of a stock write or business context. Pending synchronization is isolated by user/store and does not invent completion timestamps.
