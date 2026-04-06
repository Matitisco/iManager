## Why

The current Inventory experience is not "just a table". It combines advanced grid behaviors, server-backed data loading, category workflows, context menus, bulk actions, inline creation/editing, and subtle UX rules that already behave like product requirements. Today those behaviors are tightly coupled to Inventory, which makes reuse difficult and makes AI-assisted generation risky because a generic prompt can easily flatten or omit critical interactions.

We need a reusable table-management engine that preserves the observable behavior Inventory already guarantees while separating:

- **core grid mechanics**
- **data/persistence adapters**
- **domain plugins and workflows**

This change exists to define that reusable contract precisely enough that:

1. Inventory can migrate without regressions.
2. Future modules can adopt the engine without inheriting Inventory-specific assumptions.
3. Another AI can generate an instance from a single prompt **because the contract is explicit**, not because the prompt is vague.

## What Changes

- Define a reusable `table-engine` capability with explicit boundaries between **core**, **adapter**, and **plugin** responsibilities.
- Preserve Inventory feature parity through a dedicated parity matrix mapped against the existing Inventory specs.
- Close the architecture decision in favor of a **headless engine + typed renderers/adapters/plugins** model.
- Introduce a **promptable template contract** that documents how another module or AI should instantiate the engine safely.
- Rewrite the implementation plan so tasks are auditable and sequenced around parity, API contracts, Inventory adaptation, and verification.
- Refactor Inventory to consume the new engine only after the contract and parity requirements are satisfied.
- **BREAKING**: internal Inventory table implementation details and integration boundaries will change to adopt the new engine/adapters architecture.

## Capabilities

### New Capabilities
- `table-engine`: A reusable table-management capability that supports advanced grid behavior through:
  - a headless interaction/state engine
  - typed column and renderer contracts
  - local or remote data adapters
  - pluggable domain-specific behaviors

### Modified Capabilities
- Inventory-related capabilities will be preserved through parity with their current observable behavior, but their implementation source will move from Inventory-specific components into the reusable engine plus Inventory adapters/plugins.

## Impact

- **Frontend**: Significant refactoring in `src/pages/Inventory.tsx`, `src/components/`, and the reusable `src/components/TableEngine/` surface.
- **Modules Affected**: Inventory first. Other modules remain unchanged in this change but gain a reusable engine contract for future adoption.
- **Documentation/OpenSpec**: This change now requires and owns:
  - `parity-matrix.md`
  - `template-contract.md`
  - strengthened `design.md`
  - a rewritten `tasks.md`
- **Dependencies**: No new external dependencies are expected.
- **Backend/Schema**: No mandatory backend or Prisma schema changes are introduced by this change, though the engine contract must explicitly support both local and remote data modes.

## Non-goals

- Migrating Sales, Clients, or other modules during this change.
- Introducing product features that Inventory does not already guarantee.
- Hiding Inventory-specific behavior inside the generic engine instead of modeling it as adapters/plugins.
- Treating the current Inventory implementation as proof that a reusable engine already exists. This change must explicitly define parity and contracts before implementation is considered complete.
