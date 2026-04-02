# Architecture Map

## High-level flow
`Firebase Auth -> backend session -> onboarding (if needed) -> PostgreSQL -> frontend state`

## Key files
- `backend/src/app.ts` — backend composition and route registration
- `backend/src/modules/auth/*` — `/api/me` and session resolution
- `backend/src/modules/onboarding/*` — creates store + OWNER membership for new users
- `backend/src/modules/clients/*` — clients backend slice
- `backend/src/modules/inventory/*` — inventory backend slice
- `backend/src/modules/sales/*` — sales backend slice
- `backend/src/modules/trade-ins/*` — trade-ins backend slice
- `src/context/AppContext.tsx` — frontend state bridge and fallback logic
- `src/services/*.ts` — backend API helpers

## Live docs
- `PROJECT_STATUS.md` — current status and roadmap
- `ARCHITECTURE_DECISIONS_2026-04-02.md` — today's design rationale

## How to use this map
Open the files for the feature you are touching. Do not reread unrelated history.
