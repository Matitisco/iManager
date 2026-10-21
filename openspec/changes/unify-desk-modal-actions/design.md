## Scope and sequence

Issue #447 is delivered in two implementation layers on top of main
`ba2d91830ce7bd1b2dd3e79c1e33b51225912671`: the shared interaction core
(Sol high exception) and the seven-flow visual migration (Luna max). The
exception is justified by the reproduced close-during-persistence regression
and nested keyboard/focus behavior, not by the size of the UI work.

## Interaction core

Use one small modal-layer hook rather than a new application state manager or
dependency. Sheet/Dialog register their existing DOM surface. A React context
records parentage, including portaled children; a local registry selects the
last active branch, so only its deepest layer owns focus and dismissal.

Listen for keydown after descendant handlers, before legacy window Escape
handlers. Existing selector capture handlers keep their priority. Escape is
consumed even while busy. Contain Tab and programmatic focus in the active
surface and restore connected focus after unmount, falling back through the
parent trigger when an entire branch disappears. Changing busy/onClose does
not register a new layer or move focus.

Adapt the existing mobile DeskSelect and CatalogEditor to register their
surfaces, preserving their controls, portals and business callbacks. Do not
introduce a second inert/scroll-lock implementation: the selector already owns
that behavior. Busy is explicit, defaults to false, and gates user close
requests; successful async code may still call its existing close callback.

## Shared visual frame and actions

Sheet renders a persistent header/X, an internally scrolling body with
`min-height: 0`, and a non-shrinking footer. Its `busy` prop gates close
requests; callers pass the same pending state to their actions. An explicit
`footer` prop is preferred for migrated flows. Existing auto extraction of
`Actions` and direct `.sacts` children remains for unmigrated consumers.

`Actions` retains its existing callbacks and adds optional `more` for secondary
or destructive actions. `SheetActions` and `SheetActionMenu` support
state-specific layouts. The disclosure is native HTML, keyboard operable, and
labels its action group. Escape closes only the disclosure first and returns
focus to the summary. Footer menus float above the fixed footer. Commission
rule menus expand in the scroll flow because a floating menu at the top of the
sheet body was clipped by that body's overflow.

At most one action is styled primary for each state. Keep all current actions
and their existing authorization predicates, confirmation dialogs, callbacks,
and data calculations. Keep the yellow/black tokens and compact responsive
controls; footer and menu buttons meet 48px and 44px minimum heights
respectively. Safe-area padding protects mobile controls.

## Validation

Core regressions cover focus entry/containment/return, nested and portaled
layers, Escape/backdrop/X while busy, prop changes, unmount cleanup, selector
and state-editor compatibility, and synthetic expense persistence failure.
Focused UI tests cover sale/trade, equipment, commissions and repairs.

Synthetic browser checks cover sale detail and commission-rule menus at
1440x900, 1536x640, 390x844 and 320x844, including fixed footer geometry,
last-field reachability, keyboard menu dismissal, button hit areas and
horizontal overflow. Expense busy/error checks cover the same dimensions.
Authenticated post-deployment QA remains a release gate and cannot be replaced
by local emulation.
