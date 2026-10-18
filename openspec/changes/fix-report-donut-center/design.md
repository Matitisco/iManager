# Design

Use a pure deterministic glyph-width estimate and a 64px text budget within the 72px hole. Retain the 18px desktop / 13px phone maximum and current money formatter; if fitting needs less than 11px, use a donut-only k/M abbreviation with es-AR decimal commas (scientific notation for extreme magnitudes). Constrain the center to its budget without digit ellipsis and expose the exact amount via title and accessible text. All report tabs reuse this component. Other rings show bounded progress counts and need no change.

Verify pure formatting rules with Vitest and rendered text geometry (including actual text ranges) using desktop Chromium and iPhone WebKit. Capture before/after ARS/USD cards using synthetic local fixtures only.
