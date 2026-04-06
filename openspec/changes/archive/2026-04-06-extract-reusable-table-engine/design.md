## Context

Inventory currently behaves like a compound product surface, not like a simple reusable table. Its observable behavior spans:

- grid rendering and column management
- inline edit and inline add-row workflows
- keyboard navigation across cells
- row selection across partially loaded datasets
- context menus and bulk actions
- category drag/drop workflows
- local UX state and remote persistence
- import/export adjacent workflows

The existing reusable `TableEngine` surface is below Inventory parity, so this change cannot be a simple extraction. It must define a durable architecture that preserves Inventory behavior while making future instantiation predictable for humans and AI.

## Goals / Non-Goals

**Goals**
- Preserve the observable behavior already captured in Inventory specs.
- Define a reusable, promptable engine contract that can be instantiated safely in other modules.
- Separate reusable mechanics from Inventory-specific workflows.
- Support both local-data and remote-data modes without changing the engine contract shape.
- Make implementation auditable through a parity matrix and phased tasks.

**Non-Goals**
- Migrating additional modules in this change.
- Replacing Inventory-specific workflows with generic approximations.
- Shipping a monolithic prop-driven component that centralizes all domain behaviors in core.

## Architecture Decision

**Chosen architecture: headless engine + renderers + adapters + plugins.**

We explicitly reject the "single highly configurable component" approach for this change because it would optimize for short-term integration while creating an unstable, bloated API that another AI or team would interpret inconsistently.

### Why this decision

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Single configurable component | Faster first extraction, fewer files | Prop explosion, false genericity, hidden Inventory assumptions | Rejected |
| Compound component without explicit adapters/plugins | Some flexibility | Boundary between core and domain remains ambiguous | Rejected |
| **Headless engine + adapters/plugins** | Strongest reusability, clearest contract, better AI promptability, easier parity mapping | Higher upfront design cost | **Chosen** |

## Target Layering

```text
TableEngineCore
  +- interaction state
  +- selection model
  +- sorting/filter/search state
  +- pagination/infinite-loading orchestration
  +- inline-edit lifecycle
  +- keyboard navigation
  +- context menu / bulk action orchestration

TableRenderers
  +- text
  +- currency
  +- enum
  +- placeholder-aware display
  +- domain-provided custom renderers

TableAdapters
  +- local data adapter
  +- remote page/query adapter
  +- selection scope adapter
  +- persistence adapter for column prefs
  +- export adapter

TablePlugins
  +- Inventory category drag/drop
  +- Inventory add-item inline row
  +- Inventory-specific cell semantics
  +- future module-specific behaviors

InventoryScreen
  +- Inventory columns
  +- Inventory data queries/mutations
  +- Inventory category workflows
  +- Inventory-only panels/modals/import flows
```

## Core Contracts

The engine MUST define explicit contracts for the following concerns.

### 1. Column contract

Each column definition must be able to declare:

- `id`
- `header`
- `kind` / `rendererKey`
- editability
- sortability/filterability/searchability
- width/min-width
- visibility rules
- rename/reorder/resize participation
- placeholder behavior
- optional enum options provider

### 2. Controlled vs uncontrolled state contract

The design must not leave state ownership ambiguous.

| Concern | Default owner | Can be controlled externally? |
|---|---|---|
| active cell / inline edit session | engine | yes |
| selected row ids | engine | yes |
| column visibility/order/width/labels | engine via persistence adapter | yes |
| sort/filter/search state | engine | yes |
| page/infinite loading cursor | adapter + engine coordination | yes |
| context menu state | engine | rarely needed |

### 3. Data mode contract

The same engine API must support:

- **local mode**: all rows in memory
- **remote mode**: server-backed sort/filter/pagination/infinite loading

Remote mode must include dedicated extension points for:

- `fetchPage`
- `fetchFilteredIds`
- `updateRow`
- `createRow`
- `deleteRows`
- `moveRows`
- `exportView`

### 4. Selection model contract

Selection must support both:

- visible-page selection
- filtered-dataset/global selection through adapter-provided IDs

This avoids breaking Inventory’s current select-all behavior when only a subset of rows is loaded.

### 5. Plugin contract

Plugins must be able to:

- register row-level actions
- register bulk actions
- attach drag/drop metadata
- extend context menu sections
- react to row creation/edit completion
- supply domain-specific renderers without mutating core behavior

## Boundary Rules

### Belongs in core
- selection and range selection
- keyboard cell navigation
- inline edit lifecycle
- placeholder-aware rendering rules
- column resize/reorder/visibility/rename orchestration
- context menu infrastructure
- bulk action infrastructure
- local/remote sorting, filtering, search orchestration
- pagination / infinite loading orchestration

### Belongs in adapters
- page fetching and filter transport
- server-backed select-all ID loading
- row CRUD persistence
- column preference persistence
- export implementation

### Belongs in plugins / domain layer
- Inventory category tabs and drag-to-category
- Inventory add-item inline row semantics
- Inventory-specific status/battery presentation
- Inventory edit panel
- Inventory import workflow

## Inventory Parity Strategy

Implementation cannot be considered complete by "feature name" alone. It must preserve the fine-grained behavior already specified in:

- `inventory-inline-edit`
- `inventory-column-customization`
- `inventory-bulk-actions`
- `inventory-context-menu`
- `inventory-context-menu-add-item`
- `inventory-keyboard-cell-navigation`
- `inventory-empty-cell-placeholder`
- `inventory-enum-cell`
- `inventory-server-pagination`
- `inventory-categories` (where table/category interaction exists)

The authoritative mapping lives in `parity-matrix.md`.

## Promptable Template Contract

Because the user wants to hand this engine to another AI in a single prompt, this change must also produce a human/AI-facing contract that explains:

- what inputs define a table instance
- what behaviors come from core vs adapter vs plugin
- which callbacks are mandatory in local vs remote mode
- how to model columns and renderers
- which Inventory behaviors are required vs optional

That contract lives in `template-contract.md`.

## Risks / Trade-offs

### Risk: false genericity
If Inventory assumptions are moved into core, we create a reusable-looking engine that is still Inventory in disguise.

**Mitigation:** core/adapter/plugin boundaries are mandatory, not advisory.

### Risk: regressions in subtle UX behavior
Keyboard traversal, click vs double-click semantics, placeholder activation, optimistic overlay behavior, and selection scope are easy to simplify accidentally.

**Mitigation:** parity matrix + spec requirements + verification tasks must cover fine interactions explicitly.

### Risk: contract drift between docs and implementation

**Mitigation:** tasks include dedicated contract, parity, and verification checkpoints before migration is considered complete.

## Migration Plan

1. Strengthen the OpenSpec artifacts (parity matrix, contract, tasks, requirements).
2. Define the engine/public API before moving Inventory internals.
3. Build adapters and plugin seams before rewriting Inventory consumption.
4. Migrate Inventory incrementally with parity verification after each feature cluster.
5. Only consider the change complete once Inventory parity is evidenced against the matrix.
