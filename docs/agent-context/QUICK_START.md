# Quick Start

## 60-second bootstrap
- Open `docs/agent-context/README.md`
- Scan `PROJECT_STATUS.md`
- Open `ARCHITECTURE_DECISIONS_2026-04-02.md`
- Jump to the feature-specific handoff template when starting new work

## What matters most right now
- Firebase Auth stays for identity
- PostgreSQL is the source of truth for business data
- Railway backend is the gate for migrated core modules
- Inventory writes must not fall back silently when backend is active
- New users must complete store onboarding before using the core

## If you only read one thing
Read `PROJECT_STATUS.md`.
