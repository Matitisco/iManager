## ADDED Requirements

### Requirement: Integrated operation writes
The backend SHALL persist an integrated sale or exchange and every affected inventory, client, trade-in, and notification change atomically within one store-scoped serializable transaction.

#### Scenario: Confirm an exchange
- **WHEN** a user confirms a prepared exchange with an outgoing price greater than or equal to the received device value
- **THEN** the backend creates the outgoing sale, receives the device into inventory for the take value, updates client accounting, stores section notifications, and returns all affected records and a summary

#### Scenario: Retry a confirmation
- **WHEN** a client retries confirmation after the first confirmation committed
- **THEN** the backend returns the same linked operation records without creating duplicate sales, clients, stock, or notifications

### Requirement: Manual sold inventory registration
The backend SHALL record a pending sale registration when a user manually changes an inventory item's status to `VENDIDO`, preserving the previous inventory status for the later registration flow.

#### Scenario: Register a manually sold item
- **WHEN** an available inventory item is manually marked `VENDIDO`
- **THEN** the backend marks it pending registration, records its previous status, and allows one sale registration to claim it atomically

#### Scenario: Prevent a duplicate sale
- **WHEN** a sold inventory item already has a pending registration claimed by a sale, or a concurrent request claims it
- **THEN** a second sale cannot claim it

### Requirement: Draft and reversible exchange lifecycle
The backend SHALL allow an exchange to be prepared as a trade-in draft without creating a client, sale, or inventory item, and SHALL support confirmation and guarded cancellation as distinct from its technical trade status.

#### Scenario: Prepare draft
- **WHEN** a user saves an exchange draft
- **THEN** only a pending TradeIn is persisted

#### Scenario: Cancel unused confirmed exchange
- **WHEN** a user cancels a confirmed exchange whose received device has not been sold or used
- **THEN** the backend cancels linked business records, preserves client/history, restores outgoing inventory state, and archives the received inventory item

#### Scenario: Refuse cancellation after received stock use
- **WHEN** the received device has been sold or claimed by a pending sale
- **THEN** cancellation is rejected without partial writes

### Requirement: Durable section notifications
The backend SHALL persist one notification event for each affected section in the same transaction as the integrated operation, with per-user read state stored separately.

#### Scenario: Operation affects multiple sections
- **WHEN** an operation changes sales, inventory, clients, or trade-ins
- **THEN** one notification is persisted for each affected section and returned with the operation response

### Requirement: Source-scoped operation permissions
The backend SHALL authorize an integrated operation from its source section without granting general access to other sections.

#### Scenario: Inventory-only member records a sale
- **WHEN** a member with inventory permission uses an integrated sale from inventory
- **THEN** the operation and minimal product/client lookup are allowed while unrelated sales, client, and trade-in APIs remain protected
