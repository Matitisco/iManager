## Why
Onboarding's optional stock stage blocks access to an already-created store when progress persistence or a follow-up read fails. The network error is rendered as «No se pudo completar. Probá de nuevo.».

## What Changes
Allow owners with valid store membership to leave stock setup immediately. Remember that decision per user/store and retry progress synchronization without blocking the app. Keep real stock write failures visible.

## Capabilities
- store-onboarding: resilient optional stock completion.

## Non-goals
No visual, authentication, Prisma schema, exchange-rate or production data changes.
