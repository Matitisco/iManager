# Design

Keep input masking and existing network/header/body exclusions and before_send. Replace global text masking with `.ph-mask, [data-ph-mask], .ph-no-capture` and disable attribute masking so stylesheet link attributes survive. Add invisible data-ph-mask attributes at shared renderers and individual value nodes; preserve UI labels and import column headings. Validate TypeScript/lint, related tests (at most two workers), and the explicitly requested build. Deliver a PR without merging.
