# Issue #447 visual QA captures

These captures use only mocked API responses and synthetic fixture data. They
were checked at 1440×900, 1536×640, 390×844 and 320×844.

- `*-sale-menu.png`: completed sale detail with its secondary actions open.
- `*-commission-rule-menu.png`: saved commission rule with activate/delete
  actions open.
- `*-commission-rule-bottom.png`: commission rule body scrolled to “Vigente
  desde”; the footer remains fixed.
- `*-clients-menu.png`, `*-inventory-menu.png`, `*-tradeins-menu.png` and
  `*-service-menu.png`: client, equipment, trade-in and repair detail menus,
  including their permitted actions after body scroll.
- `*x*-expense-busy.png` and `*x*-expense-error.png`: pending persistence and
  failed synthetic save with the draft retained.

The browser checks assert visible action targets, menu Escape/focus return,
fixed footer position, last-field reachability and no horizontal overflow.
These local captures do not represent deployed or authenticated QA.

The local Sol review refreshed this set after fixing the repair menu's left
edge clipping and the legacy mobile footer rules. All 36 captures use synthetic
data; no camera hardware or deployed session was used.
