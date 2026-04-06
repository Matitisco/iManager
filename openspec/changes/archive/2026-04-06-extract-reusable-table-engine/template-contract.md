# Table Engine Promptable Template Contract

This document defines the minimum contract required to instantiate the reusable table engine from a human-written or AI-generated prompt.

## 1. Mental Model

Every table instance is composed from four layers:

1. **Core** - reusable grid mechanics and interaction state
2. **Renderers** - how cells display/edit values
3. **Adapters** - how data, persistence, and export are loaded/saved
4. **Plugins** - domain-specific workflows that should not live in core

If a requested behavior is domain-specific, it MUST be expressed as a plugin or adapter concern rather than pushed into core.

## 2. Required Inputs

An instance definition must describe:

- table purpose
- row shape
- column definitions
- data mode (`local` or `remote`)
- enabled engine features
- required actions (row/bulk/context)
- persistence needs
- domain plugins

## 3. Column Definition Contract

Each column definition should specify, at minimum:

- `id`
- `label`
- `rendererKey` (`text`, `currency`, `enum`, custom key, etc.)
- `editable`
- `sortable`
- `filterable`
- `searchable`
- `placeholderBehavior`
- `width` / `minWidth`
- `renameable`
- `reorderable`
- `hideable`
- `enumOptions` or options provider when applicable

## 4. Data Adapter Contract

### Local mode

Provide:
- full dataset in memory
- optional local filter/sort/search helpers if custom logic is needed

### Remote mode

Provide:
- `fetchPage`
- `fetchFilteredIds` (required if global select-all exists)
- `updateRow`
- `createRow` (only if inline add-row exists)
- `deleteRows`
- optional `moveRows`
- optional `exportView`
- optional `loadColumnPrefs` / `saveColumnPrefs`

## 5. Plugin Contract

Use a plugin when the behavior is not generic grid behavior. Plugins may:

- register row actions
- register bulk actions
- attach drag/drop metadata
- render domain-specific draft rows
- hook into row creation/edit completion
- supply custom renderers

Examples:

- Inventory category drag/drop -> plugin
- Inventory inline `Agregar item` row -> plugin
- Inventory battery/status visual semantics -> renderer/plugin

## 6. Feature Questions an AI Must Answer

Before generating an instance, the prompt or configuration must answer:

1. Is data local or remote?
2. Does selection apply only to visible rows or the entire filtered dataset?
3. Are column preferences persisted?
4. Which cells are editable, and with which editor types?
5. Is there keyboard traversal across cells?
6. Are there domain-specific actions or workflows that must be plugins?
7. Is inline row creation required?
8. Is drag/drop required? If yes, what owns the drop semantics?

## 7. Inventory Mapping Example

### Core
- selection + range selection
- inline edit lifecycle
- keyboard cell navigation
- placeholder-aware rendering
- column resize/reorder/rename/visibility
- context menu infrastructure

### Adapters
- remote inventory paging/filtering/sorting
- filtered ID lookup for select-all
- row create/update/delete persistence
- export
- column preference persistence

### Plugins
- categories and drag-to-category
- inline add-item workflow
- Inventory-specific cell semantics/panels

## 8. Guardrails

- Do not hardcode Inventory labels, statuses, categories, or workflows into core.
- Do not assume the full dataset is loaded in memory.
- Do not treat placeholder display strings as persisted values.
- Do not mark an engine integration complete unless parity has been checked against `parity-matrix.md`.
