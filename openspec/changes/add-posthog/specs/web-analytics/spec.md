## ADDED Requirements

### Requirement: Guarded collection
The web app SHALL collect PostHog events in the US only outside development, test and automation, with a nonempty project key. Analytics SHALL never throw into product flows.

#### Scenario: Disabled runtime
- **WHEN** development, Vitest, test mode, webdriver, E2E flags or an empty key is present
- **THEN** initialization, capture, identify and reset are no-ops

### Requirement: Minimal identity and successful funnel events
The app SHALL identify with internal user/store IDs and role, reset on logout, and emit the requested signup, onboarding, inventory, import, operation and invitation events only at their corresponding completed actions.

#### Scenario: Failed persistence
- **WHEN** a business write fails
- **THEN** no success event is emitted; failed imports include only a row count

### Requirement: Private collection without visible changes
The app SHALL track canonical SPA pageviews and autocapture without visible UI changes. The `sale_created` event SHALL allow only these sale-detail properties: `quantity`, `unit_price`, `total`, `currency`, `model`, `capacity`, `stock_deducted`, `stock_left`, `sale_id`, and `status`. Amounts and the internal sale ID are explicitly permitted for this event. Model and capacity SHALL come from the sold inventory product and be trimmed to 60 characters. Missing or invalid properties SHALL be omitted; numeric properties SHALL be finite, currency SHALL be ARS/USD, and status SHALL be COMPLETADA/PENDIENTE. `stock_left` SHALL be the returned product's remaining quantity after the sale, included only when stock was deducted and the product was found. Sale-detail properties SHALL exclude customer names, phone numbers, email, IMEIs, notes, payment methods, free text and tokens. Other events SHALL retain their existing property rules. URLs SHALL contain only canonical route labels, without record IDs, query values or tokens.

#### Scenario: Saved sale details
- **WHEN** a sale is successfully created or a draft trade-in is confirmed
- **THEN** `sale_created` includes only the valid allowlisted sale details, with unit price calculated from the saved total and quantity and rounded to two decimals
- **AND** failed persistence, sale edits, cancellations and restorations emit no new sale event

#### Scenario: Readable replay and protected URLs
- **WHEN** business amounts or ordinary inputs are rendered and navigation contains record IDs, query values or tokens
- **THEN** replay retains its existing readable behavior and password/payment protections, while event URLs include only canonical route labels
- **AND** adding sale details changes neither replay settings nor visible UI
