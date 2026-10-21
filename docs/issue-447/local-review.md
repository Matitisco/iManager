# Issue #447 — local Sol review

Reviewed `057645c24d854f15b649dfee0bece38480944680`, keeping its parent interaction
core `666fa5b31b65e7e19bd05f5a92a26a58b0c52ff2`. Corrections are additive on the
same branch. The local `origin` URL resolves to the expected `Matitisco/iManager`
repository; this was a local config read, not a remote operation.

## Resolved findings

1. **Shared destructive confirmation could dismiss during persistence.** The
   reason sheet disabled its footer but did not pass `busy` to Sheet. X,
   backdrop and Escape could therefore discard an in-flight archive/void.
   The sheet now shares the pending state, including alternate navigation.
   A held/rejected synthetic request verifies that the reason and error stay
   visible, without a success notice or a duplicate request.
2. **The universal frame changed manual sheets.** Applying flex/overflow/padding
   to every `.sheet` clipped direct content such as invitation permissions on
   desktop and doubled padding in the dollar calculator. The fixed frame is
   now scoped to `.sheet-frame`. Chromium regressions check manual scrolling,
   final-action reachability at both desktop sizes and dollar spacing.
3. **Disclosure focus boundaries included hidden actions.** The layer selected
   buttons from closed `<details>` while missing native summaries. It now
   includes summaries and skips hidden disclosure contents. Tests cover closed
   and open menu boundaries, Escape/focus return and the desktop header X.
4. **Repair menus could leave the sheet on its left edge.** Menus in the first
   footer column now anchor left. Legacy mobile one-column rules exclude the
   new action hierarchy, so client/trade menus no longer cover the visible
   close action. E2E checks every menu action and trial-clicks the direct close
   action while the menu is open.
5. **The existing scanner was outside the new focus stack.** Above a caller
   Sheet, its live and permission surfaces could lose focus to the parent, and
   Escape reached the parent. Both existing surfaces now register through the
   same small layer adapter. Synthetic tests cover both surfaces and return to
   the intact caller. Acquisition, decoding, streams and lens-switching code
   are unchanged; no hardware QA is claimed.

The corresponding new regressions failed against the implementation before
their fixes. Three existing tests were updated because desktop Sheet now has
the shared X; their focus/footer assertions remain active.

## Scope and validation

The audit compared action predicates and callbacks with the base: permissions,
confirmation text, sale/trade persistence, client payment conversion, expense
accounting, repair progression and stock rules remain in their existing flows.
Body navigation that can replace equipment/operation forms is disabled while
their existing save is pending. No backend, service API, dependency, permission
model or financial formula was changed.

- Full frontend suite: **156 files / 1098 tests passed**. Browser-only unit
  cases use the installed system Chromium through an environment-only setup.
- Final action/layout/persistence E2E: **16 passed, no retries** at 1440×900,
  1536×640, 390×844 and 320×844. All business APIs are intercepted synthetic
  responses; no real persistence or credentials are used.
- Frontend and backend TypeScript checks and `git diff --check` passed. No build
  was run.
- The [36 persisted captures](visual-qa/README.md) were refreshed and inspected.
  They cover sale, commission rules, client, equipment, trade-in and repair
  menus, rule last-field reachability, and expense busy/error states.

## Remaining gates

This is local code/Chromium review. A follow-up run uses an isolated disposable
PostgreSQL database and the test-auth backend to exercise existing persistence
flows. Its final focused result is recorded separately below. Safari, physical camera/lens
behavior and authenticated browser QA after deployment remain unverified.
CI, main/deploy version checks and deployed QA are still required before issue
closure; local captures do not replace them.

At the end of this local review, publication was blocked by the auto-review
denial of the branch push. Specific approval to publish #447 to
`Matitisco/iManager` was subsequently received on 2026-10-21. Normal CI/review
gates still apply. No push retry, alternate upload, PR, merge, remote change or
permission change was performed during the local review itself.

## Publication follow-up

The branch was pushed and PR #471 was opened after the specific publication
approval. Existing E2E flows now reveal secondary actions using the native
footer disclosure before clicking them. Header dismissal is explicitly scoped
where the new desktop X duplicates the footer label. No permission, confirmation,
financial-result or persistence assertions were removed. Confirmed trade-ins now
assert Edit at rest and Save state after an actual status change. Rule actions
reopen their disclosure after each confirmation. Negative sensitive-action
checks include hidden elements so a closed menu cannot mask an unauthorized action.

The final focused database run passed **28 tests, 3 workers, 0 retries** in
2.2 minutes. It covers existing cash-operation sale/edit/cancel behavior, client
deposit application/refund, draft recovery, linked-operation editing/cancellation,
failed persistence, repair detail/editor transitions, owner/staff budget/delete
permissions and repair layout at desktop/mobile widths. All data belongs to an
isolated disposable PostgreSQL database with test authentication.

External backend exchange-rate retrieval was unavailable in the first local run
and caused existing sale setup paths without a frozen rate to fail. The final
run used an environment-only Node fetch adapter returning a fixed synthetic
1300 quote exclusively for the external blue-rate URL; business APIs and the
backend source remained real and unchanged. Other intermediate failures were
the old hidden-action selectors corrected here. The complete unmodified CI
workflow remains a required independent gate.

A repeated 1536×640 synthetic layout case also passed with CI's normal 10-second
startup expectation after an earlier local 5-second startup timeout under load.
WebKit is exercised by CI, not by substituting Chromium for a WebKit device.
The final selector changes passed frontend TypeScript; backend TypeScript also
passed in this publication follow-up. No build was run.
