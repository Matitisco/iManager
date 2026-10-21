# Issue #447 — shared modal layout and action hierarchy

Base: `ba2d91830ce7bd1b2dd3e79c1e33b51225912671` (`main`). Branch:
`fix/447-modal-interaction-core`. Sol's tested interaction-core commit remains
`666fa5b31b65e7e19bd05f5a92a26a58b0c52ff2`.

This delivery completes the shared modal frame and action hierarchy for
commission rules/payments, expenses, sales, trade-ins, equipment, clients and
repairs. It preserves the yellow/black desk tokens and leaves permissions,
callbacks, confirmation text and financial calculations owned by their current
flows. It adds no backend work, dependency or build output.

## Shared `Sheet` contract

`Sheet` renders a persistent title/subtitle header and close button, a
`min-height: 0` internally scrolling body, and a non-shrinking footer. Its
existing optional `busy` prop gates X/backdrop/Escape. Pass the same live busy
state to the footer controls; caller-owned actions remain explicitly disabled
while their request is pending. A successful callback can still close the sheet
programmatically after persistence completes.

An explicit `footer` places that content in the fixed footer and leaves children
in the scroll body. Without `footer`, the existing `Actions` component and
direct children with an `.sacts` class continue to be extracted automatically.
That keeps unmigrated/manual Sheet consumers working.

```tsx
<Sheet
  title="Editar registro"
  busy={busy}
  onClose={close}
  footer={
    <Actions
      busy={busy}
      secondary="Cancelar"
      onSecondary={close}
      primary="Guardar"
      onPrimary={() => void save()}
      more={<button className="btn2 danger" type="button" disabled={busy} onClick={archive}>Archivar</button>}
    />
  }
>
  {/* Existing fields, error state and callbacks. */}
</Sheet>
```

`Actions` keeps its two existing required callbacks and accepts optional
`more`. `SheetActions` is the wrapper for a state-specific custom footer; mark
one visible action `.sheet-primary` and the supporting action
`.sheet-secondary`. `SheetActionMenu` uses the native `<details>/<summary>`
disclosure and gives its contents a labelled `role="group"`. Its default label
is “Más acciones”; rule cards use “Acciones de la regla”. Enter or Space opens
it. Escape closes only that disclosure and returns focus to its summary before
the shared modal layer handles Escape. Selecting an action closes it and
restores focus. Menus anchored in a footer float above it; saved-rule menus
expand inline inside the scroll body so that the body never clips their
buttons.

```tsx
<SheetActions>
  <button className="btn2 s sheet-secondary" type="button" onClick={close}>Cerrar</button>
  <SheetActionMenu>
    <button className="btn2 s" type="button" onClick={edit}>Editar</button>
    <button className="btn2 danger" type="button" onClick={confirmCancel}>Cancelar operación</button>
  </SheetActionMenu>
  <button className="btn2 p sheet-primary" type="button" onClick={save}>Guardar</button>
</SheetActions>
```

Footer controls have at least 48px height, menu items at least 44px; wrapping
and two-column compact footers preserve the full 320px viewport. The fixed
footer respects the mobile safe area. Existing yellow/black colors, round
controls and button tokens remain in use.

## Migrated flows

- Commission rules keep `Guardar regla` primary and `Cancelar` secondary.
  Activate/deactivate and delete stay attached to each saved rule; delete and
  state changes still use the existing confirmation dialog. Commission payment
  remains `Registrar pago` plus `Cancelar`; member detail keeps payment/`Listo`
  primary and `Cambiar regla` secondary.
- Expenses keep save/restore primary and close secondary. Archive appears in
  the menu only for an existing, non-archived expense and still uses its
  confirmation. A failed save keeps the current draft and error.
- Sale forms keep confirm/save primary and close secondary. `Guardar pendiente`
  remains available in the menu under the existing draft condition. A pending
  sale uses `Marcar cobrada` primary; a completed sale uses `Compartir
  comprobante`. Edit, return and cancellation remain available only in the
  same prior states and permission conditions.
- Trade-in actions remain state-specific: pending operations keep `Retomar`
  primary; a confirmed operation uses `Editar` or `Guardar estado` depending on
  whether its technical status changed. Cancellation stays permission-gated
  and confirmation-backed. The legacy progress flow keeps advance primary and
  reject/after secondary.
- Equipment keeps `Guardar estado` primary and `Cerrar` secondary; `Vender`
  stays in the menu when the existing stock predicate permits it.
- Client detail uses `Registrar pago` as primary for an outstanding balance,
  otherwise `Nueva venta`. Close remains secondary; deposit, edit and any
  additional sale action remain under their prior conditions. The payment
  sheet keeps its existing confirmation callback.
- Repair detail uses the next status as primary while one exists, and
  `Compartir comprobante` at the terminal status. Close, receipt, deposit and
  edit stay discoverable in the menu under their existing conditions.

## Validation and visual evidence

- Frontend and backend TypeScript checks passed: `npm run lint` and
  `npm --prefix backend run lint`.
- Six focused Vitest files passed: **91 passed**. The temporary
  Vitest config only points Playwright's browser-only unit cases at the
  installed `/usr/bin/chromium`.
- The synthetic browser matrix passed **8/8** at 1440×900, 1536×640, 390×844
  and 320×844. It checks sale action menus, fixed footers, last-field reach,
  commission-rule action menus, keyboard dismissal/focus return, 44px menu
  targets and horizontal overflow. Every API response is intercepted and uses
  synthetic fixtures.
- The pending/failed expense persistence regression passed **4/4** at the same
  sizes. It verifies focus containment and that a 503 preserves the draft.
- After screenshots were captured and visually checked for clipping and
  reachable controls. The synthetic evidence is persisted in
  `docs/issue-447/visual-qa/`: sale-detail menus, rule menus, rule-sheet
  last-field states and per-viewport expense busy/error states. No production
  or real-account data was used.
- `git diff --check` passed. No build was run. The database-backed sale-detail
  suite was not run because local API port 3100 is unavailable; its modal and
  geometry coverage was replaced here by fully intercepted synthetic data.

Merge remains gated on green CI and Sol high review without bypass. #447 stays
open until authenticated browser QA after deployment records the served
version. Production QA is not claimed in this delivery.
