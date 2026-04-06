# TableEngine

Reusable table infrastructure for React with an **API-first** contract:

- **headless-friendly core**
- **adapter-driven data access**
- **plugin-based domain workflows**
- **explicit state boundaries**

This package is mid-migration from a basic prop-driven table to the reusable engine described in OpenSpec. The current component still supports the legacy `features` + `callbacks` API, while `types.ts` now defines the richer contract needed for Inventory parity and future non-Inventory tables.

## Design goals

1. **No hidden domain assumptions** — inventory-specific workflows must live in adapters/plugins, not in core.
2. **Promptable contract** — another AI should be able to instantiate a table by reading the contracts, not by reverse-engineering Inventory.
3. **Controlled/uncontrolled clarity** — selection, sorting, editing, pagination, filters, search, and column preferences must have explicit ownership.
4. **Remote-data parity** — the engine must work for local arrays and for remote paginated/filterable datasets.

## Current public surface

### 1) Columns

`ColumnDef<TData>` now models:

- stable column ids
- accessor keys or accessor functions
- renderer/editor keys
- enum options
- placeholder semantics
- editability
- sort participation
- column customization participation
- width / min / max constraints

### 2) State contracts

`TableControlledState` and `TableStateChangeHandlers` define explicit boundaries for:

- sorting
- pagination
- selection
- inline editing
- filters
- search
- column preferences
- context menu state

### 3) Data adapters

`TableDataAdapter<TData>` supports:

- `local` mode
- `remote` mode with `fetchPage`
- optional `fetchFilteredIds`
- optional column preference persistence
- optional export hook

### 4) Plugins

`TablePlugin<TData>` supports:

- row actions
- bulk actions
- renderer/edit participation
- external drop target labeling
- prompt-contract extension

## Transitional usage

The current `TableEngine` component still renders from the legacy props:

```tsx
<TableEngine
  data={rows}
  columns={columns}
  features={{ sorting: true, rowSelection: true }}
  callbacks={{ onSelectionChange: handleSelection }}
/>
```

But new work should start by defining:

```tsx
const adapter = {
  mode: 'remote' as const,
  fetchPage: async (query) => loadUsers(query),
  fetchFilteredIds: async (query) => loadAllMatchingIds(query),
};

const columns: ColumnDef<User>[] = [
  {
    id: 'name',
    header: 'Nombre',
    accessorKey: 'name',
    rendererKey: 'text',
    sortable: true,
    editable: true,
    placeholder: { value: '---', treatEmptyStringAsMissing: true },
  },
];
```

## Prompt contract helper

Use `buildTablePromptContract()` when you need a machine-readable summary of:

- supported adapter modes
- plugin-based actions
- selection scope requirements
- column preference persistence expectations
- required discovery questions before another AI generates a new table

## Structure

- `/components` — UI slices used by the current renderer
- `/hooks` — reusable state hooks from the legacy engine
- `types.ts` — source of truth for the evolving contract
- `contract.ts` — prompt-contract helper for humans/AI
- `TableEngine.tsx` — current orchestration component, still backwards-compatible
