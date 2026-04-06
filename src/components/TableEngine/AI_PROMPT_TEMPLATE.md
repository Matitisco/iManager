# TableEngine AI Prompt Template

Use this template when asking another AI to instantiate a new table from the reusable engine.

The goal is **not** “make a table that kinda looks like Inventory”.  
The goal is to force the AI to declare:

- data mode
- state ownership
- column contracts
- selection semantics
- plugin boundaries
- persistence expectations

---

**Prompt:**

You are implementing a new table-based screen using `src/components/TableEngine`.

Follow these rules:

1. Treat the engine as **headless core + adapters + plugins**, not as a domain component.
2. Do **not** hardcode domain workflows into the engine.
3. Make all assumptions explicit in code and in your response.
4. Preserve placeholder semantics (`---` when applicable), explicit renderer keys, and controlled/uncontrolled state boundaries.

## 1) Screen and domain

- Section name: **[Section Name]**
- Component path: **[Path]**
- Domain row type: **[TypeName]**

```ts
export interface [TypeName] {
  id: string;
  // ...other fields
}
```

## 2) Data mode

Choose one and implement accordingly:

- `local`
- `remote`

If `remote`, implement or wire an adapter with:

- `fetchPage(query)`
- `[optional] fetchFilteredIds(query)` if selection can target the filtered dataset beyond the current page
- `[optional] persistColumnPreferences(next)`
- `[optional] exportRows(context)`

## 3) State ownership

State each one as **controlled** or **uncontrolled**:

- sorting
- pagination
- selection
- editing
- filters
- search
- column preferences
- context menu

## 4) Columns

Define `ColumnDef<[TypeName]>[]` with explicit values for:

- `id`
- `header`
- `accessorKey` or `accessorFn`
- `rendererKey`
- `[optional] editorKey`
- `sortable`
- `editable`
- `placeholder`
- `enableColumnCustomization`
- `[optional] enumOptions`

Columns to implement:

- [Column A]
- [Column B]
- [Column C]

## 5) Selection semantics

State which one applies:

- only current page
- filtered dataset

If filtered dataset selection is required, explain how `fetchFilteredIds()` is used.

## 6) Plugins

List what belongs in plugins instead of core:

- row actions
- bulk actions
- drag/drop workflows
- domain renderers
- add-row workflows

If no plugin is needed, say so explicitly.

## 7) Expected UX rules

Specify whether this table requires:

- placeholder rendering (`---`)
- single click behavior
- double click behavior
- enum single-click editing
- keyboard navigation
- inline add-row
- remote sorting/filtering/search

## 8) Deliverables

Provide:

1. the complete component code
2. the adapter code if needed
3. plugin definitions if needed
4. a short explanation of which responsibilities live in core vs adapter vs plugin

Before generating code, include a short assumptions section. If any required detail is missing, state the assumption explicitly instead of inventing hidden behavior.
