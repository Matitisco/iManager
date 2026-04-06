## ADDED Requirements

### Requirement: Promptable Table Instance Contract
The system SHALL provide a reusable `table-engine` capability whose public contract is explicit enough to instantiate a table from configuration alone, without relying on hidden Inventory assumptions.

#### Scenario: Basic instantiation
- **WHEN** a module renders the engine with typed column definitions, a data adapter or local dataset, and feature/plugin configuration
- **THEN** the engine renders a data grid that behaves according to the declared contract rather than Inventory-specific hardcoded logic

#### Scenario: Promptable configuration handoff
- **WHEN** another developer or AI receives the template contract for the engine
- **THEN** they can determine which parts belong to core, adapters, and plugins without reading Inventory internals

### Requirement: Column Customization With Persisted Preferences
The system SHALL support column resize, reorder, rename, and visibility control, with preference persistence delegated through a configurable persistence layer.

#### Scenario: Resizing a column
- **WHEN** the user drags the resize handle of a column header
- **THEN** the column width updates in real time and respects the minimum width rule defined by the engine

#### Scenario: Reordering columns
- **WHEN** the user drags a column header to a new position
- **THEN** the engine reorders the columns visually and updates the persisted preference state

#### Scenario: Renaming a column
- **WHEN** the user renames a configurable column from the header UI
- **THEN** the new label is reflected anywhere that column label is surfaced by the engine configuration

#### Scenario: Reload preserves preferences
- **WHEN** the user reloads a table instance after modifying width, order, visibility, or labels
- **THEN** the same preferences are restored through the configured persistence adapter

### Requirement: Inline Editing Preserves Fine-Grained Activation Rules
The system SHALL support inline editing for text, numeric, and enum cells while preserving activation, save, cancel, and optimistic display rules.

#### Scenario: Text cell edit activation
- **WHEN** the user activates an editable text or numeric cell using the configured interaction pattern
- **THEN** the engine opens an inline editor focused on that cell and preserves the current displayed value semantics

#### Scenario: Placeholder cell edit activation
- **WHEN** the user activates an editable cell that is currently rendered with a placeholder for an empty value
- **THEN** the inline editor opens with an empty value instead of the placeholder display string

#### Scenario: Enum cell activation
- **WHEN** the user activates an editable enum cell
- **THEN** the engine renders the configured select/dropdown editor with the valid options for that column

#### Scenario: Save with optimistic display
- **WHEN** the user confirms an inline edit and the persistence callback has not resolved yet
- **THEN** the engine keeps the new value visible immediately and does not flash the previous persisted value while waiting

#### Scenario: Cancel edit
- **WHEN** the user cancels inline editing with the configured cancel action
- **THEN** the editor closes without persisting changes and the prior value remains visible

### Requirement: Keyboard Navigation Across Editable Cells
The system SHALL support keyboard traversal across editable cells and rows while preserving save and focus-transfer semantics.

#### Scenario: Tab advances horizontally
- **WHEN** the user presses Tab while editing a cell that is not the last editable cell in the row
- **THEN** the current value is committed through the configured edit flow and the next editable cell in the row enters edit mode

#### Scenario: Shift+Tab moves backward
- **WHEN** the user presses Shift+Tab while editing a cell that is not the first editable cell in the row
- **THEN** the current value is committed and the previous editable cell in the row enters edit mode

#### Scenario: Enter moves vertically
- **WHEN** the user presses Enter while editing a cell and another row exists below
- **THEN** the current value is committed and the same column in the next row becomes the active edit target

#### Scenario: Arrow navigation preserves focus rules
- **WHEN** the user presses an arrow-navigation key while editing a cell
- **THEN** the engine follows the configured vertical navigation behavior without dropping the edit/save semantics

### Requirement: Selection Supports Page Scope and Filtered Dataset Scope
The system SHALL support row selection for visible rows, range selection, and adapter-driven select-all across filtered datasets that are not fully loaded in memory.

#### Scenario: Shift range selection
- **WHEN** the user selects one row and then shift-selects another row in the same visible result set
- **THEN** all rows in the range become selected

#### Scenario: Header selection for visible rows
- **WHEN** the user toggles the header checkbox in a partially loaded result set
- **THEN** the visible rows are selected or deselected according to the engine configuration

#### Scenario: Filtered select-all through adapter
- **WHEN** the user requests select-all for a filtered dataset whose full rows are not loaded
- **THEN** the engine uses the configured adapter to fetch the filtered row IDs and applies selection to the full filtered dataset

#### Scenario: Escape clears selection
- **WHEN** the user presses Escape while a multi-row selection is active
- **THEN** the engine clears the selection state

### Requirement: Context Menu and Bulk Actions Are Extensible
The system SHALL provide extensible row and bulk action infrastructure without hardcoding Inventory-specific menu items into core.

#### Scenario: Row context menu
- **WHEN** the user opens a context menu on a row
- **THEN** the engine renders the configured row actions for that row and current selection context

#### Scenario: Bulk action dispatch
- **WHEN** one or more rows are selected and the user triggers a configured bulk action
- **THEN** the engine dispatches the action through the configured action contract with the relevant row scope

### Requirement: Inline Add-Row Is Supported Through Plugins
The system SHALL support optional inline row-creation workflows through plugins or instance configuration rather than hardcoding an Inventory-only create flow into core.

#### Scenario: Inline add-row from action
- **WHEN** a table instance configures an inline row-creation action and the user triggers it
- **THEN** the engine renders a single inline creation row according to the configured schema and focus rules

#### Scenario: Prevent duplicate inline draft rows
- **WHEN** an inline creation row is already active and the user triggers the create-row action again
- **THEN** the engine does not create a second draft row and instead returns focus to the existing draft row

### Requirement: Local and Remote Data Modes Share the Same Engine Contract
The system SHALL support local-only datasets and remote server-backed datasets without changing the core engine API shape.

#### Scenario: Local sort/filter/search
- **WHEN** a table instance provides local data mode
- **THEN** the engine can apply sort, filter, search, and pagination locally according to the instance configuration

#### Scenario: Remote sort/filter/search
- **WHEN** a table instance provides remote data mode
- **THEN** the engine delegates sort, filter, search, and paging requests through the configured data adapter instead of assuming the full dataset is in memory

#### Scenario: Remote page transition
- **WHEN** the user changes page or triggers infinite loading in remote mode
- **THEN** the engine requests the next result slice through the adapter while preserving current sort/filter/search state

### Requirement: Drag and Drop Is Plugin-Driven
The system SHALL support row drag metadata and external drop targets when configured, without coupling the core engine to Inventory category workflows.

#### Scenario: Draggable row metadata
- **WHEN** a table instance enables row dragging
- **THEN** the engine exposes the row payload and drag metadata required by the configured plugin or drop target

### Requirement: Placeholder-Aware Rendering
The system SHALL render empty values through placeholder-aware display rules while preserving editability and renderer-specific behavior.

#### Scenario: Empty text value
- **WHEN** a text-like cell value is empty according to the configured empty-value rules
- **THEN** the engine renders the placeholder display state while keeping the cell interactive if editable

#### Scenario: Empty non-text value
- **WHEN** a non-text renderer receives an empty value
- **THEN** the engine renders the placeholder state instead of a misleading domain representation such as a badge or progress bar

### Requirement: Export Uses the Active View Contract
The system SHALL support export through a configurable export adapter that can operate on the current view or selected rows.

#### Scenario: Export active view
- **WHEN** the user triggers export for the current table instance
- **THEN** the engine calls the configured export adapter with the current visible/sorted/filtered view contract
