# Design

Use the sale-corrections target guards and serializable transaction/rollback pattern. Share pure workbook/grid/number/payload helpers inside the backend compilation root, re-exporting them from the frontend. Detect existing IMEI updates and possible identifier-free duplicates before writes; omit physical source rows before grouping. Verify inventory and sales invariants and return a private before-state backup.
