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


## CI regression follow-up — run 39605091284

[The PR-head workflow](https://github.com/Matitisco/iManager/actions/runs/39605091284)
for `88e5844f76efb0681d5da49d5c051899542b74a3` passed frontend/backend
TypeScript, the full frontend suite, PWA including WebKit/Chromium, backend unit
and integration checks. Its E2E step had **296 passed, 1 failed, 7 existing
skips**. The only failure was `account-current.flow.ts:40`: the desktop payment
button measured 46.084px, then 47.592px on retry, against the unchanged 48px
minimum assertion.

The shared footer had reduced the former desktop `.btn2` height from 52px to
48px. The inherited `pop` opening animation scales from 0.94; the target therefore
fell below 48px until the animation ended. A Chromium comparison using the CSS
from the exact base commit and PR head, with the real animation paused at its
initial frame, establishes that this was introduced by #447:

| Version | CSS button height | Rendered opening height |
| --- | --- | --- |
| Base `ba2d918` | 52px | 48.88px |
| PR head `88e5844` | 48px | 45.12px |
| Corrected shared desktop footer | 52px | 48.88px |

The correction restores the original generic desktop action height and aligns
its footer disclosure with it. Mobile retains 48px targets and its existing
translation animation. Saved-rule disclosures and manual sheets retain their
existing sizing. No original E2E assertion, timeout, retry count or skip was
changed.

Validation after the correction:

- The unchanged desktop account-current E2E passed **5 consecutive repetitions,
  0 retries** against isolated PostgreSQL/test authentication and the same
  temporary synthetic external-quote adapter described above.
- **7 browser compatibility tests passed**, including four new deterministic
  tests sampling opening at 0/50/100/200ms at all four required viewports. They
  retain the 48px minimum during animation and verify final viewport containment.
- **16 synthetic modal E2E passed, 0 retries**. All 36 captures were regenerated;
  the desktop set and full-size low-height/mobile samples were visually checked
  for complete actions, contained menus and accessible footers.
- Frontend/backend TypeScript and whitespace checks passed. No build was run.

A new normal CI run is required for the corrected commit before merge. #447
remains open until authenticated deployed QA; no production QA is claimed here.


## CI geometry synchronization follow-up

The PR workflow for `6944f2779bf7b83a2171e9f38995e65e354acdb2` completed
successfully ([run 39625781474](https://github.com/Matitisco/iManager/actions/runs/39625781474)).
It verified 1102 frontend tests, 516 backend unit tests, 322 backend integration
tests and the configured PWA checks. E2E reported 295 passed, 2 flaky and 7
existing skips; both initially failing cases passed the configured retry.

One initial failure belongs to the new modal layout coverage: at 390px, the
footer's vertical position changed by 0.770px between measurements because the
sheet's opening translation was still running. A temporary synthetic diagnostic
extended that real animation to 2 seconds and reproduced the unchanged 0.5px
geometry assertion failing with a 1.564px movement. The test now awaits the
sheet's actual animation completion before taking the first measurement. No
assertion, tolerance, timeout, retry, skip or application behavior changed.

The controlled slow-opening case then passed five consecutive repetitions with
zero retries. This diagnostic adapter exists only under `/tmp`; the repository
change is the explicit animation synchronization in the existing test. The other
initial failure was `mobile-notifications.spec.ts:174` (an inventory unread
counter). Its cause is unclassified; this report does not claim it predates
#447, and its assertions were not modified.

The full local synthetic matrix also passed 16/16 tests with zero retries after
synchronization. Frontend/backend TypeScript and whitespace checks passed; no
build was run. The synchronized test requires normal CI on its own commit
before merge.
