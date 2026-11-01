## ADDED Requirements

### Requirement: Platform administrator inventory import
The endpoint SHALL resolve exactly one owner store and validate its exact name and currency, reuse analyze/apply/importInventoryItems within one serializable transaction, support XLSX or grids and physical-row omissions, and return diagnostics and backup.

#### Scenario: Simulated import
- **WHEN** an authorized administrator requests dryRun
- **THEN** the full import and postconditions run and all database writes roll back.

#### Scenario: Confirmed import
- **WHEN** an authorized administrator applies with matching expected counts and acknowledged or omitted possible duplicates
- **THEN** the import commits with a summary audit event, preserving sales and unrelated inventory.

#### Scenario: Guard failure
- **WHEN** target guards, expected counts, duplicate consent or postconditions fail
- **THEN** the request fails with no committed writes.
