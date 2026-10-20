## Why

Issue #440 records navigation decisions and an intermittent Prisma P2034 from the post-QA pass. Resolve the software work with reproducible evidence, and keep physical scanner checks distinct from browser simulation.

## What Changes

- Move Proveedores from Stock to Finanzas alongside Gastos, retaining inventory-based authorization and old links.
- Show labels on every mobile navigation button, with equal touch targets and the existing active indicator.
- Investigate transaction conflicts in the sale creation/cancellation flow; verify concurrent cancellation is atomic and idempotent and expose exhausted conflicts as actionable errors.
- Record a physical-device scanner checklist and the actual limits of automated validation.

## Capabilities

### New Capabilities
- `desk-navigation`: supplier grouping, compatible routes and persistent mobile labels.
- `operation-conflict-recovery`: bounded transaction retries and atomic concurrent cancellation.
- `scan-camera-control`: readable camera preview, native zoom and safe rear-lens switching after a physical Galaxy S23 test showed blur and failed IMEI reads.

### Modified Capabilities
None.

## Impact

Frontend navigation, hash routing and mobile CSS; backend transaction handling and operation regression tests; QA documentation. No Prisma schema changes or AppContext changes.

## Non-goals

- SMTP configuration is deferred at the user's request.
- Browser tests do not certify camera performance, flashlight, permissions on installed PWAs, USB/Bluetooth readers, low light, or curved labels on physical devices.
