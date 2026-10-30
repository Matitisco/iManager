# Design

Change only the input/text masking options in the single `posthog.init` in `src/lib/posthog-analytics.ts`. Preserve attribute visibility, disabled request headers/bodies, network masking, `before_send`, and all other options.

Audit `src/` for card, CVV, payment and token inputs, plus login, reset and account passwords. Login/registration and reset passwords can become `type="text"`; add `ph-no-capture` to those inputs so visibility toggles cannot expose them. Account passwords remain `type="password"` and use SDK password masking. Protect the existing billing payer email in display and edit modes with `ph-no-capture`. No card-number, expiry, CVV or payment-token inputs exist; checkout redirects to Mercado Pago. Payment methods and business amounts are not payment credentials.

Legacy `data-ph-mask` attributes remain in place but have no configured masking selector. There are no other code-managed PostHog privacy configurations in frontend, backend, Vite or server scripts.

Validate only frontend/backend TypeScript lint and the two PostHog test files, at most two workers. Deliver a PR against `test`, wait for green CI, then squash merge into `test`.
