## 1. Specification Hardening

- [x] 1.1 Produce and maintain `parity-matrix.md` mapping current Inventory behavior/specs to `table-engine` core/adapter/plugin responsibilities
- [x] 1.2 Produce and maintain `template-contract.md` describing the promptable instantiation contract for humans and AI
- [x] 1.3 Close the architectural decision in `design.md` around headless core + renderers + adapters + plugins
- [x] 1.4 Expand the `table-engine` delta spec so it explicitly preserves fine-grained Inventory interaction rules

## 2. Engine Public API Definition

- [x] 2.1 Define the typed column contract, including renderer keys, editability, placeholder semantics, enum support, and column customization participation
- [x] 2.2 Define controlled/uncontrolled state boundaries for editing, selection, sort/filter/search, pagination, context menu, and column preferences
- [x] 2.3 Define the local-data and remote-data adapter contracts, including `fetchPage`, `fetchFilteredIds`, persistence, and export hooks
- [x] 2.4 Define the plugin contract for row actions, bulk actions, drag/drop, add-row workflows, and domain renderers

## 3. Inventory Parity Extraction

- [x] 3.1 Extract or rework selection behavior to preserve checkbox selection, shift+range selection, escape-to-clear, and filtered select-all
- [x] 3.2 Extract or rework column customization to preserve resize, reorder, rename, and persisted preferences
- [x] 3.3 Extract or rework inline editing to preserve placeholders, enum cells, optimistic overlay behavior, and click/double-click semantics
- [x] 3.4 Extract or rework keyboard traversal to preserve Tab, Shift+Tab, Enter, and arrow-key behavior
- [x] 3.5 Extract or rework context menu and inline add-row behavior to preserve Inventory flows without moving Inventory-only workflows into core
- [x] 3.6 Extract or rework pagination/infinite-loading behavior to preserve remote sorting/filtering/search and adapter-driven paging

## 4. Inventory Adapter and Plugin Migration

- [x] 4.1 Build the Inventory data adapter(s) for page loading, filtered IDs, row mutations, export, and column preference persistence
- [x] 4.2 Build Inventory-specific plugins/renderers for categories, drag-to-category, add-item inline row, and domain-specific cell presentation
- [x] 4.3 Refactor `Inventory` to consume the engine contract instead of its current internal table implementation
- [x] 4.4 Remove dead Inventory table code only after parity evidence exists for the migrated behavior

## 5. Verification and Auditability

- [x] 5.1 Verify each migrated feature cluster against `parity-matrix.md`
- [x] 5.2 Produce a formal verification report summarizing preserved behaviors, known gaps, and evidence
- [x] 5.3 Confirm the promptable template contract is sufficient for instantiating a non-Inventory table without relying on hidden assumptions
- [x] 5.4 Mark tasks complete only when parity evidence exists; do not mark checklist items complete based solely on scaffold extraction
