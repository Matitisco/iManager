# Issue #447 — interaction core and Luna handoff

Base: `ba2d91830ce7bd1b2dd3e79c1e33b51225912671` (main, 2026-10-21).
Branch: `fix/447-modal-interaction-core`. OpenSpec:
`openspec/changes/unify-desk-modal-actions/`.

This is the approved Sol high exception for shared focus/dismissal behavior.
The visual migration remains for Luna max. No CSS, backend, AppContext,
permissions, money calculations, dependencies or schema changes. No build,
production writes, issue closure, merge or deployed-QA claim.

## Reproduction and result

On the base, Nuevo gasto closes on Escape while its synthetic save is pending;
opening Sheet leaves focus outside it. Nested layers have independent Escape
handlers. The new unit regressions fail 10/12 cases against the base and pass
with this core (the other two cases exercise existing success/selector behavior).

The core contains focus inside the top registered surface, consumes only its
Escape, blocks user dismissal while busy, and restores connected trigger focus.
Tests include React StrictMode, a child initially rendered through a portal,
whole-branch removal, prop changes, disabled/hidden controls, mobile selectors,
the state editor, calendar Escape, and failed/successful expense persistence.

## Public contract for Luna

`Sheet` adds optional `busy?: boolean` (default `false`). `Dialog` keeps its
existing busy prop and applies it consistently to dismissal. Existing DOM/CSS,
children/footer extraction, footer prop and action APIs remain compatible.

```tsx
<Sheet
  title="Editar registro"
  busy={busy}
  onClose={close}
  footer={<Actions busy={busy} primary="Guardar" onPrimary={() => void save()} onSecondary={close} />}
>
  {error ? <div className="ferr" role="alert">{error}</div> : null}
  {/* Existing fields and callbacks. */}
</Sheet>
```

- Pass the same actual pending state to **both Sheet and its Actions**, including
  local `saving` or `ruleAction` states as appropriate. The core does not infer
  busy from DOM, child buttons or business state. Only ExpenseForm is wired in
  this delivery; the remaining callers are intentionally pending.
- Busy blocks the shared X, backdrop and Escape. Dialog also guards its cancel
  button. Caller-owned buttons/callbacks still belong to the caller: keep them
  disabled/guarded while incompatible requests are pending.
- Keep successful persistence calling the existing `close()` directly after
  await. Busy blocks user dismissal, not programmatic success. Preserve failure
  handling and values; do not put a busy guard around the success callback.
- Default initial Sheet focus is its dialog surface (`tabIndex=-1`), so opening
  does not scroll to a field/action. Dialog initially focuses Cancelar, falling
  back to the surface while its buttons are disabled.
- Context preserves ownership through React portals. Closing a child returns
  focus inside the parent; removing a whole branch tries surviving outer
  triggers. Disconnected, disabled, hidden and inert targets are skipped.
- The hook contains focus; it does not add an inert or scroll-lock system.
  DeskSelect retains its existing inert/scroll ownership. Avoid competing traps.
- Descendant Escape handlers run first. A custom popover must consume Escape
  before it reaches the shared document handler. DeskSelect already does this;
  ReportDatePicker now does so in capture. Do not attach another raw window
  Escape listener to Sheet/Dialog.

For an existing custom modal that needs to join the stack, use the internal
adapter already demonstrated by CatalogEditor. Do not register a second layer
around a Sheet/Dialog:

```tsx
const ref = useRef<HTMLDivElement>(null);
const modal = useModalLayer({ ref, onClose, busy });
return (
  <ModalLayerContext.Provider value={modal.scope}>
    <div className="ov" onMouseDown={modal.requestClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true"
        aria-label={title} onMouseDown={event => event.stopPropagation()}>
        {/* Surface contents; close controls call modal.requestClose. */}
      </div>
    </div>
  </ModalLayerContext.Provider>
);
```

The adapter supports optional `enabled` and `initialFocus` refs for an existing
conditionally opened surface. Its scope is Sheet/Dialog, CatalogEditor and the
mobile DeskSelect; it does not automatically migrate every custom modal in the
application. Camera behavior is untouched.

## Remaining Luna scope

1. `ui.tsx`, `desk.css`, `close-button.tsx`: persistent header/X, body with
   `min-height: 0` and internal scroll, explicit non-shrinking footer, dvh/safe
   areas and compact desktop controls. Preserve yellow/black desk tokens and
   the working sale/equipment fixes. Be careful with manual `.sheet` consumers.
2. `screens/commission-sheets.tsx`, `screens/CommissionsScreen.tsx`,
   `overlays/expense.tsx`, `operation.tsx`, `trade.tsx`, `equipment.tsx`,
   `client.tsx`, `RepairForms.tsx`: explicit footers, correct busy state and
   state-specific primary/secondary hierarchy. Preserve all current allowed
   actions, financial callbacks and confirmations. No commission redesign #463.
3. `DeskOverlays.tsx`, `overlays/shared.tsx` and necessary compatibility adapters:
   preserve confirmation/error behavior. Smoke-test filters, Cajas, Proveedores,
   señas, catalog, batch loading/import and invitations without expanding scope.
4. Update `operation-detail.test.tsx` and `e2e/sale-detail-layout.spec.ts` for the
   new hierarchy: test every action inside the secondary disclosure instead of
   requiring five large buttons. Preserve entry points from Ventas, Reportes,
   Dashboard and notifications. Keep `e2e/row-actions-sheet.spec.ts` coverage.
5. Before/after visual QA at 1440x900, 1536x640, 390x844 and 320px wide, including
   last-field reachability, long/empty/loading/error states, keyboard and menu/
   confirmation layers. The core browser tests do not establish layout fixes.

## Verification and release gates

Core regression files: `src/desk/modal-layer.test.tsx`,
`src/desk/overlays/expense-modal.test.tsx`, `e2e/modal-interactions.spec.ts`.
The E2E uses entirely intercepted synthetic APIs and the test auth adapter,
without credentials or real persistence. Its held save is released as a 503;
Escape/backdrop/X cannot dismiss it, and error/draft survive without success.

Required checks remain frontend/backend TypeScript and the frontend suite;
no build. The environment lacks Playwright's downloaded Chromium executable.
Browser-only Vitest cases can use the existing `/usr/bin/chromium` through a
temporary test configuration; no repository dependency/config change is needed.

Results on 2026-10-21:

- `npm run lint` and `npm --prefix backend run lint`: passed in parallel.
- New unit regressions: 12 passed; against base ba2d918, 10 failed and 2 passed.
  Temporary base files were restored before the final verification.
- Full frontend suite: **155 files / 1089 tests passed**, using
  `/tmp/imanager447/vitest.full.config.ts`. Its extra setup only supplies
  `/usr/bin/chromium` to Playwright launch; application code is unchanged by it.
  The earlier ordinary full run passed 1080 tests but could not start four
  browser-only files (seven cases) because the downloaded executable is absent;
  the final full rerun resolved that environment limitation.
- New `e2e/modal-interactions.spec.ts`: **4 passed, no retries**, at 1440x900,
  1536x640, 390x844 and 320x844. Ran with Vite test-auth mode and a separate API
  origin to exercise CORS fixtures, using
  `/tmp/imanager447/playwright.core.config.ts`. Every API was intercepted; no
  backend process, database or real credentials were needed.
- `git diff --check`: passed. OpenSpec's four artifacts and normative scenarios
  were checked locally; the OpenSpec CLI is not installed in this environment.
- No build or production endpoint retry.

Merge requires green CI and Sol high review without bypass. Keep #447 open
until authenticated browser QA after deployment records the served version.
The earlier read of production `version.json` was denied by a 403 tunnel; this
delivery does not retry it or claim production validation. #455's separate
post-deploy QA remains pending as already recorded by the parent.
