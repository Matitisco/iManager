## Scope and sequence

The approved #447 plan is split into an interaction core (Sol high exception)
and a later visual migration (Luna max). The exception is justified by the
reproduced pending-request dismissal and nested keyboard/focus interactions,
not the size of the UI work. The working base is main ba2d918.

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
that behavior. Keep Sheet's DOM, footer extraction and CSS unchanged in this
delivery. Busy is explicit, defaults to false, and gates user close requests;
successful async code may still call its existing close callback directly.

## Later visual migration

Luna will move the header outside the scrolling body, make footers explicit for
the seven flows, compact detail actions and keep one primary action per state.
Preserve the existing design tokens, all allowed actions, confirmation copy,
permissions, currencies, calculations and persistence callbacks. Do not
reinterpret the old compact-sale-detail requirement as requiring five large
buttons: all actions must remain discoverable and keyboard/touch accessible.

## Validation

Core regressions: focus entry/containment/return, nested and portaled layers,
Escape/backdrop/X while busy, prop updates, unmount cleanup, selector/state
editor compatibility, and synthetic expense persistence failure.
Frontend/backend TypeScript and focused frontend regressions; no build.
Visual migration acceptance remains 1440x900, 1536x640, 390x844 and 320px wide,
with stable before/after captures, last-field reachability and deployed QA.
