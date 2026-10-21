# Hide camera switching in inventory and sales scanners

## Why

The camera switch was added to diagnose a physical Galaxy S23 scan failure. Inventory and Sales should now open the browser's default rear camera without offering a lens switch in those workflows.

## Scope

For the Inventory equipment form, batch inventory load, Inventory scan review, and Sales camera scanner, hide the visible “Cambiar cámara” action while preserving scan, retry, torch, manual entry, and confirmation behavior. Keep camera switching available in other scanner contexts, including Stock Count and Trade-ins.

## Non-goals

- Do not change camera selection, focus, zoom, stream lifecycle, barcode parsing, or scan persistence.
- Do not change scanner behavior for Stock Count, Trade-ins, or other non-Inventory/Sales contexts.
- Do not change backend, AppContext, Prisma schema, permissions, or production configuration.
- Do not claim hardware validation from browser emulation.

## Affected modules

- Inventory
- Sales
- Shared camera scanner presentation

## Acceptance

- Inventory and Sales scanners never show “Cambiar cámara”, including when multiple rear lenses are available.
- Their existing camera scan flow still reads the same supported codes and lets the user review/use the result.
- Scanner contexts outside Inventory and Sales retain lens switching when multiple rear lenses are available.
- Automated checks and synthetic screenshots cover the scoped flows.
- After review, CI, merge, and confirmed deploy, verify the UI in a browser at desktop and mobile sizes with read-only navigation, save evidence, and keep #455 open until that check passes.

The pull request must reference #455 without an auto-closing keyword. Close the issue manually only after the deployed UI check passes.
