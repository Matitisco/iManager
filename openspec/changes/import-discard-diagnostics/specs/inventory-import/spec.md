## ADDED Requirements

### Requirement: Aggregate import diagnostics
Spreadsheet analysis and application SHALL add detected/accepted/discarded row counts, discard reason counts and stable missingRequiredFields/missingRecommendedFields keys, both for heuristic and model analysis. Persistence results SHALL report reason counts for rejected rows. Existing row inclusion and persistence rules MUST remain unchanged.

#### Scenario: Stock with cost and no sale price
- **WHEN** stock has model and cost but no sale price
- **THEN** price remains unmapped, missingRequiredFields contains price and missing_price counts rejected product rows

#### Scenario: Mixed rows and expanded units
- **WHEN** a data range contains blank/footer/section rows and products with quantities
- **THEN** each physical row has one accepted/discarded outcome while existing rowCount counts units

### Requirement: Cost cannot become sale price
Automatic mappings SHALL reject cost/purchase headers for price and recognize sale-price aliases Venta, PVP, Precio USD and $ in heuristic and OpenAI paths.

#### Scenario: Model suggests cost as price
- **WHEN** OpenAI maps a purchase/cost header to price
- **THEN** the mapping is removed and missing price is explicitly reported

### Requirement: Aggregate import analytics
PostHog SHALL receive import type, phase, detected/imported/discarded counts, reason counts and missing field keys without cell values, names or IMEIs.

#### Scenario: Zero prepared rows
- **WHEN** analysis discards every stock row for missing price
- **THEN** its aggregate event reports zero imported rows and missing_price even without a persistence request
